package com.sinsera.gossoko.visits;

// Gossoko check-ins, arrival alerts and visit prompts (Android).
//
// The web app (sinsera.co/gossoko/admin/, src/lib/visits/) sends the venues, settings and rules
// (src/lib/visits/policy.ts, same numbers) through configure(). From then on this runs on its own, also
// while Gossoko is closed. Each watched venue gets two geofences:
//   "a:<id>"  ENTER / EXIT / DWELL after 2 min → the "At <venue>?" alert (drive-pasts never dwell);
//   "r:<id>"  DWELL after 20 min               → "How was <venue>?".
// Leaving after ≥10 min without the 20-min prompt sends it then; a stay of ≥2 min is kept as a visit,
// uploaded by the web app later as an 'auto' check-in (takeVisits). Positions stay on the phone.
// Android allows 100 geofences per app → the 50 venues nearest to where the app was last opened.

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.sinsera.gossoko.MainActivity;
import com.sinsera.gossoko.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

public final class VisitsEngine {
    public static final String CHANNEL = "gossoko_visits";
    public static final String EXTRA_PATH = "gossokoPath";
    static final String ACTION_MUTE = "com.sinsera.gossoko.visits.MUTE";
    static final String EXTRA_VENUE = "gossokoVenue";
    private static final String PREFS = "gossoko.visits";

    private VisitsEngine() {}

    // ── storage ───────────────────────────────────────────────────────────────
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static JSONObject obj(Context c, String key) {
        try { return new JSONObject(prefs(c).getString(key, "{}")); } catch (JSONException e) { return new JSONObject(); }
    }
    static JSONArray arr(Context c, String key) {
        try { return new JSONArray(prefs(c).getString(key, "[]")); } catch (JSONException e) { return new JSONArray(); }
    }
    static void put(Context c, String key, Object v) { prefs(c).edit().putString(key, v.toString()).apply(); }

    static JSONObject config(Context c) { return obj(c, "config"); }
    static JSONObject settings(Context c) { JSONObject s = config(c).optJSONObject("settings"); return s != null ? s : new JSONObject(); }
    static JSONObject rules(Context c) { JSONObject r = config(c).optJSONObject("rules"); return r != null ? r : new JSONObject(); }
    static boolean enabled(Context c) { return settings(c).optBoolean("enabled", false); }

    static JSONObject venue(Context c, String id) {
        JSONArray vs = config(c).optJSONArray("venues");
        if (vs == null) return null;
        for (int i = 0; i < vs.length(); i++) { JSONObject v = vs.optJSONObject(i); if (v != null && id.equals(v.optString("id"))) return v; }
        return null;
    }

    static Set<String> muted(Context c) {
        Set<String> out = new HashSet<>(); JSONArray a = arr(c, "muted");
        for (int i = 0; i < a.length(); i++) out.add(a.optString(i));
        return out;
    }
    static void setMuted(Context c, Set<String> m) { put(c, "muted", new JSONArray(m)); }

    // ── permissions ───────────────────────────────────────────────────────────
    static boolean has(Context c, String p) { return ContextCompat.checkSelfPermission(c, p) == PackageManager.PERMISSION_GRANTED; }
    static boolean fine(Context c) { return has(c, Manifest.permission.ACCESS_FINE_LOCATION); }
    static boolean background(Context c) { return Build.VERSION.SDK_INT < 29 || has(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION); }

    // ── geofences ─────────────────────────────────────────────────────────────
    static PendingIntent geofenceIntent(Context c) {
        Intent i = new Intent(c, GeofenceReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, 0, i, flags);
    }

    /** (Re)register the geofences for the nearest venues, or remove them all when off / not allowed. */
    @SuppressLint("MissingPermission")
    public static void refresh(Context ctx) {
        final Context c = ctx.getApplicationContext();
        GeofencingClient client = LocationServices.getGeofencingClient(c);
        client.removeGeofences(geofenceIntent(c)).addOnCompleteListener(t -> {
            if (!enabled(c) || !fine(c) || !background(c)) return;
            LocationServices.getFusedLocationProviderClient(c).getLastLocation()
                .addOnCompleteListener(l -> register(c, client, l.isSuccessful() ? l.getResult() : null));
        });
    }

    @SuppressLint("MissingPermission")
    private static void register(Context c, GeofencingClient client, Location here) {
        JSONArray vs = config(c).optJSONArray("venues");
        if (vs == null || vs.length() == 0) return;
        JSONObject r = rules(c);
        List<JSONObject> list = new ArrayList<>();
        for (int i = 0; i < vs.length(); i++) { JSONObject v = vs.optJSONObject(i); if (v != null) list.add(v); }
        if (here != null) {
            Collections.sort(list, (a, b) -> Float.compare(dist(here, a), dist(here, b)));
        }
        int max = Math.max(1, r.optInt("maxRegionsAndroid", 100) / 2);
        float radius = (float) r.optDouble("regionRadiusM", 100);
        int arrivalMs = (int) (r.optDouble("arrivalDwellS", 120) * 1000);
        int reviewMs = (int) (r.optDouble("reviewDwellS", 1200) * 1000);
        List<Geofence> fences = new ArrayList<>();
        for (JSONObject v : list.subList(0, Math.min(max, list.size()))) {
            double lat = v.optDouble("lat"), lng = v.optDouble("lng");
            if (Double.isNaN(lat) || Double.isNaN(lng)) continue;
            String id = v.optString("id");
            fences.add(new Geofence.Builder().setRequestId("a:" + id).setCircularRegion(lat, lng, radius)
                .setExpirationDuration(Geofence.NEVER_EXPIRE).setLoiteringDelay(arrivalMs)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT | Geofence.GEOFENCE_TRANSITION_DWELL)
                .build());
            fences.add(new Geofence.Builder().setRequestId("r:" + id).setCircularRegion(lat, lng, radius)
                .setExpirationDuration(Geofence.NEVER_EXPIRE).setLoiteringDelay(reviewMs)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL).build());
        }
        if (fences.isEmpty()) return;
        GeofencingRequest req = new GeofencingRequest.Builder().setInitialTrigger(0).addGeofences(fences).build();
        try { client.addGeofences(req, geofenceIntent(c)); } catch (SecurityException ignored) { /* permission withdrawn */ }
    }

    private static float dist(Location here, JSONObject v) {
        float[] out = new float[1];
        Location.distanceBetween(here.getLatitude(), here.getLongitude(), v.optDouble("lat"), v.optDouble("lng"), out);
        return out[0];
    }

    public static void stop(Context ctx) {
        Context c = ctx.getApplicationContext();
        try {
            JSONObject cfg = config(c); JSONObject s = cfg.optJSONObject("settings");
            if (s != null) { s.put("enabled", false); put(c, "config", cfg); }
        } catch (JSONException ignored) { }
        put(c, "stays", new JSONObject());
        LocationServices.getGeofencingClient(c).removeGeofences(geofenceIntent(c));
    }

    // ── rules (mirror src/lib/visits/policy.ts) ──────────────────────────────
    private static int minutes(String hhmm) {
        String[] p = hhmm == null ? new String[0] : hhmm.trim().split(":");
        if (p.length != 2) return -1;
        try { int h = Integer.parseInt(p[0]), m = Integer.parseInt(p[1]); return h < 24 && m < 60 ? h * 60 + m : -1; }
        catch (NumberFormatException e) { return -1; }
    }
    static boolean inQuietHours(long atMs, JSONObject s) {
        int f = minutes(s.optString("quietFrom", "20:00")), t = minutes(s.optString("quietTo", "05:00"));
        if (f < 0 || t < 0 || f == t) return false;
        Calendar cal = Calendar.getInstance(); cal.setTimeInMillis(atMs);
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        return f < t ? (now >= f && now < t) : (now >= f || now < t);
    }
    private static JSONObject memory(Context c, String id) {
        JSONObject all = obj(c, "memory"); JSONObject m = all.optJSONObject(id); return m != null ? m : new JSONObject();
    }
    private static void setMemory(Context c, String id, String key, long v) {
        try { JSONObject all = obj(c, "memory"); JSONObject m = all.optJSONObject(id); if (m == null) m = new JSONObject(); m.put(key, v); all.put(id, m); put(c, "memory", all); }
        catch (JSONException ignored) { }
    }
    private static boolean reviewAllowed(Context c, JSONObject v, long now) {
        JSONObject s = settings(c), r = rules(c);
        String id = v.optString("id");
        if (!s.optBoolean("enabled") || !s.optBoolean("prompts", true) || muted(c).contains(id) || v.optBoolean("reviewedRecently")) return false;
        if (inQuietHours(now, s)) return false;
        long last = memory(c, id).optLong("lastReviewPrompt", 0);
        return last == 0 || now - last >= (long) (r.optDouble("reviewGapD", 7) * 86_400_000L);
    }

    // ── events ────────────────────────────────────────────────────────────────
    static void onEnter(Context c, String id, Location at) {
        JSONObject v = venue(c, id); if (v == null || !enabled(c)) return;
        try {
            JSONObject stays = obj(c, "stays");
            if (stays.has(id)) return;
            JSONObject st = new JSONObject();
            st.put("enteredAt", System.currentTimeMillis());
            st.put("lat", at != null ? at.getLatitude() : v.optDouble("lat"));
            st.put("lng", at != null ? at.getLongitude() : v.optDouble("lng"));
            st.put("accuracy", at != null ? at.getAccuracy() : rules(c).optDouble("regionRadiusM", 100));
            st.put("reviewSent", false);
            stays.put(id, st); put(c, "stays", stays);
        } catch (JSONException ignored) { }
    }

    static void onArrivalDwell(Context c, String id, Location at) {
        JSONObject v = venue(c, id); if (v == null || !enabled(c)) return;
        if (!obj(c, "stays").has(id)) onEnter(c, id, at);  // ENTER can be skipped when the phone was already there
        JSONObject s = settings(c), r = rules(c);
        long now = System.currentTimeMillis();
        if (!s.optBoolean("arrival", true) || muted(c).contains(id) || inQuietHours(now, s)) return;
        long last = memory(c, id).optLong("lastArrivalAlert", 0);
        if (last != 0 && now - last < (long) (r.optDouble("arrivalGapH", 20) * 3_600_000L)) return;
        setMemory(c, id, "lastArrivalAlert", now);
        notify(c, "a:" + id, id, v.optString("arrivalTitle"), v.optString("arrivalBody"), v.optString("arrivalPath"));
    }

    static void onReviewDwell(Context c, String id) {
        JSONObject v = venue(c, id); if (v == null) return;
        long now = System.currentTimeMillis();
        if (!reviewAllowed(c, v, now)) return;
        setMemory(c, id, "lastReviewPrompt", now);
        try {
            JSONObject stays = obj(c, "stays"); JSONObject st = stays.optJSONObject(id);
            if (st != null) { st.put("reviewSent", true); put(c, "stays", stays); }
        } catch (JSONException ignored) { }
        notify(c, "r:" + id, id, v.optString("reviewTitle"), v.optString("reviewBody"), v.optString("reviewPath"));
    }

    static void onExit(Context c, String id) {
        JSONObject stays = obj(c, "stays"); JSONObject st = stays.optJSONObject(id);
        if (st == null) return;
        stays.remove(id); put(c, "stays", stays);
        JSONObject v = venue(c, id); if (v == null) return;
        JSONObject r = rules(c);
        long now = System.currentTimeMillis();
        long entered = st.optLong("enteredAt", now);
        double stayedS = (now - entered) / 1000.0;
        if (!st.optBoolean("reviewSent") && stayedS >= r.optDouble("reviewOnLeaveMinS", 600) && reviewAllowed(c, v, now)) {
            setMemory(c, id, "lastReviewPrompt", now);
            notify(c, "r:" + id, id, v.optString("reviewTitle"), v.optString("reviewBody"), v.optString("reviewPath"));
        }
        if (stayedS >= r.optDouble("arrivalDwellS", 120)) {
            try {
                JSONArray q = arr(c, "queue");
                JSONObject visit = new JSONObject();
                visit.put("venueId", id); visit.put("at", entered); visit.put("leftAt", now);
                visit.put("lat", st.optDouble("lat")); visit.put("lng", st.optDouble("lng")); visit.put("accuracy", st.optDouble("accuracy"));
                q.put(visit);
                while (q.length() > 200) q.remove(0);
                put(c, "queue", q);
            } catch (JSONException ignored) { }
        }
    }

    // ── notifications ─────────────────────────────────────────────────────────
    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Nearby venues", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("At a venue? Check in, and how was it?");
            nm.createNotificationChannel(ch);
        }
    }

    @SuppressLint("MissingPermission")
    private static void notify(Context c, String tag, String venueId, String title, String body, String path) {
        if (Build.VERSION.SDK_INT >= 33 && !has(c, Manifest.permission.POST_NOTIFICATIONS)) return;
        ensureChannel(c);
        int code = tag.hashCode();
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra(EXTRA_PATH, path);
        PendingIntent tap = PendingIntent.getActivity(c, code, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent mute = new Intent(c, MuteReceiver.class).setAction(ACTION_MUTE).putExtra(EXTRA_VENUE, venueId).putExtra("tag", tag);
        PendingIntent mutePi = PendingIntent.getBroadcast(c, code + 1, mute, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_gossoko)
            .setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true).setContentIntent(tap)
            .addAction(0, "Don't ask for this place", mutePi)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        NotificationManagerCompat.from(c).notify(tag, 7101, b.build());
    }

    // ── handed to the web app ─────────────────────────────────────────────────
    static JSONArray takeVisits(Context c) { JSONArray q = arr(c, "queue"); put(c, "queue", new JSONArray()); return q; }

    static void forgetStaysNotIn(Context c, Set<String> ids) {
        JSONObject stays = obj(c, "stays");
        List<String> drop = new ArrayList<>();
        for (Iterator<String> it = stays.keys(); it.hasNext(); ) { String k = it.next(); if (!ids.contains(k)) drop.add(k); }
        for (String k : drop) stays.remove(k);
        put(c, "stays", stays);
    }
}
