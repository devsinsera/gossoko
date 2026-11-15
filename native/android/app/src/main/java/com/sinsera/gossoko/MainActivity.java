package com.sinsera.gossoko;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.sinsera.gossoko.visits.VisitsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Gossoko's own plugin: check-ins, arrival alerts and visit prompts (visits/VisitsEngine.java).
        registerPlugin(VisitsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
