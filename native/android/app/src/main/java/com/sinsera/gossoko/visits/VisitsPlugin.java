package com.sinsera.gossoko.visits;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** JS name "GossokoVisits" — see src/lib/visits/index.ts and VisitsEngine. */
@CapacitorPlugin(
    name = "GossokoVisits",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "background", strings = { "android.permission.ACCESS_BACKGROUND_LOCATION" }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" }),
    }
)
public class VisitsPlugin extends Plugin {

    @Override
    public void load() {
        VisitsEngine.ensureChannel(getContext());
        // Opened by tapping an alert while Gossoko was closed.
        if (getActivity() != null) keepPath(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String path = intent == null ? null : intent.getStringExtra(VisitsEngine.EXTRA_PATH);
        if (path == null) return;
        intent.removeExtra(VisitsEngine.EXTRA_PATH);
        if (hasListeners("open")) { JSObject d = new JSObject(); d.put("path", path); notifyListeners("open", d); }
        else VisitsEngine.prefs(getContext()).edit().putString("open", path).apply();
    }

    private void keepPath(Intent intent) {
        String path = intent == null ? null : intent.getStringExtra(VisitsEngine.EXTRA_PATH);
        if (path == null) return;
        intent.removeExtra(VisitsEngine.EXTRA_PATH);
        VisitsEngine.prefs(getContext()).edit().putString("open", path).apply();
    }

    private JSObject status() {
        JSObject r = new JSObject();
        String loc;
        if (VisitsEngine.fine(getContext())) loc = VisitsEngine.background(getContext()) ? "always" : "whenInUse";
        else loc = getPermissionState("location") == PermissionState.DENIED ? "denied" : "none";
        r.put("location", loc);
        String n;
        if (Build.VERSION.SDK_INT < 33 || VisitsEngine.has(getContext(), "android.permission.POST_NOTIFICATIONS")) n = "granted";
        else n = getPermissionState("notifications") == PermissionState.DENIED ? "denied" : "prompt";
        r.put("notifications", n);
        return r;
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(status()); }

    @PluginMethod
    public void requestWhenInUse(PluginCall call) {
        if (VisitsEngine.fine(getContext())) { askNotifications(call); return; }
        requestPermissionForAlias("location", call, "afterLocation");
    }

    @PermissionCallback
    private void afterLocation(PluginCall call) { askNotifications(call); }

    private void askNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotifications");
        } else {
            call.resolve(status());
        }
    }

    @PermissionCallback
    private void afterNotifications(PluginCall call) { call.resolve(status()); }

    /** Android 11+ sends the person to the app's location page to pick "Allow all the time". */
    @PluginMethod
    public void requestAlways(PluginCall call) {
        if (!VisitsEngine.fine(getContext()) || VisitsEngine.background(getContext())) { call.resolve(status()); return; }
        requestPermissionForAlias("background", call, "afterBackground");
    }

    @PermissionCallback
    private void afterBackground(PluginCall call) {
        VisitsEngine.refresh(getContext());
        call.resolve(status());
    }

    @PluginMethod
    public void configure(PluginCall call) {
        try {
            JSONObject cfg = new JSONObject();
            JSObject settings = call.getObject("settings", new JSObject());
            JSObject rules = call.getObject("rules", new JSObject());
            JSArray venues = call.getArray("venues", new JSArray());
            cfg.put("settings", settings);
            cfg.put("rules", rules);
            cfg.put("venues", venues);
            VisitsEngine.put(getContext(), "config", cfg);
            Set<String> ids = new HashSet<>();
            for (int i = 0; i < venues.length(); i++) { JSONObject v = venues.optJSONObject(i); if (v != null) ids.add(v.optString("id")); }
            VisitsEngine.forgetStaysNotIn(getContext(), ids);
            VisitsEngine.refresh(getContext());
            JSObject r = new JSObject();
            int max = rules.optInt("maxRegionsAndroid", 100) / 2;
            boolean on = settings.optBoolean("enabled") && VisitsEngine.fine(getContext()) && VisitsEngine.background(getContext());
            r.put("watching", on ? Math.min(max, venues.length()) : 0);
            call.resolve(r);
        } catch (JSONException e) {
            call.reject("Bad visits config: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) { VisitsEngine.stop(getContext()); call.resolve(); }

    @PluginMethod
    public void takeVisits(PluginCall call) {
        JSONArray q = VisitsEngine.takeVisits(getContext());
        JSObject r = new JSObject();
        try { r.put("visits", new JSArray(q.toString())); } catch (JSONException e) { r.put("visits", new JSArray()); }
        call.resolve(r);
    }

    @PluginMethod
    public void takeOpen(PluginCall call) {
        String p = VisitsEngine.prefs(getContext()).getString("open", null);
        VisitsEngine.prefs(getContext()).edit().remove("open").apply();
        JSObject r = new JSObject();
        r.put("path", p);
        call.resolve(r);
    }

    @PluginMethod
    public void mutedCount(PluginCall call) {
        JSObject r = new JSObject(); r.put("count", VisitsEngine.muted(getContext()).size()); call.resolve(r);
    }

    @PluginMethod
    public void clearMuted(PluginCall call) { VisitsEngine.setMuted(getContext(), new HashSet<>()); call.resolve(); }
}
