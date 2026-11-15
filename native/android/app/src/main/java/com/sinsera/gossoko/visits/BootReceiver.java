package com.sinsera.gossoko.visits;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android forgets every geofence on a restart or an app update: put them back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            VisitsEngine.refresh(context);
        }
    }
}
