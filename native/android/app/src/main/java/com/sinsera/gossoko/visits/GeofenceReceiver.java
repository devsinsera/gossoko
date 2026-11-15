package com.sinsera.gossoko.visits;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingEvent;

/** Geofence transitions from Google Play services (also while Gossoko is closed). */
public class GeofenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null) return;
        if (ev.hasError()) {
            // Location turned off / Google location accuracy off: Android drops every geofence.
            if (ev.getErrorCode() == GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE) VisitsEngine.prefs(context).edit().putBoolean("needsRefresh", true).apply();
            return;
        }
        Location at = ev.getTriggeringLocation();
        int t = ev.getGeofenceTransition();
        if (ev.getTriggeringGeofences() == null) return;
        for (Geofence g : ev.getTriggeringGeofences()) {
            String rid = g.getRequestId();
            if (rid.length() < 3) continue;
            String id = rid.substring(2);
            if (rid.startsWith("a:")) {
                if (t == Geofence.GEOFENCE_TRANSITION_ENTER) VisitsEngine.onEnter(context, id, at);
                else if (t == Geofence.GEOFENCE_TRANSITION_DWELL) VisitsEngine.onArrivalDwell(context, id, at);
                else if (t == Geofence.GEOFENCE_TRANSITION_EXIT) VisitsEngine.onExit(context, id);
            } else if (rid.startsWith("r:") && t == Geofence.GEOFENCE_TRANSITION_DWELL) {
                VisitsEngine.onReviewDwell(context, id);
            }
        }
    }
}
