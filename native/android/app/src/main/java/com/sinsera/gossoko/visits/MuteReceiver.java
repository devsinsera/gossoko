package com.sinsera.gossoko.visits;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import java.util.Set;

/** "Don't ask for this place" on an arrival alert or review prompt. */
public class MuteReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!VisitsEngine.ACTION_MUTE.equals(intent.getAction())) return;
        String id = intent.getStringExtra(VisitsEngine.EXTRA_VENUE);
        if (id == null) return;
        Set<String> m = VisitsEngine.muted(context);
        m.add(id);
        VisitsEngine.setMuted(context, m);
        String tag = intent.getStringExtra("tag");
        if (tag != null) NotificationManagerCompat.from(context).cancel(tag, 7101);
    }
}
