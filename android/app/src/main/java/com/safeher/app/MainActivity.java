package com.safeher.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SosTriggerPlugin.class);
        registerPlugin(TextScannerPlugin.class);
        registerPlugin(ImageClassifierPlugin.class);
        registerPlugin(LocalStorePlugin.class);
        registerPlugin(SmartAlertPlugin.class);
        super.onCreate(savedInstanceState);
        handleTriggerIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleTriggerIntent(intent);
    }

    @Override
    public void onStop() {
        super.onStop();
        // Only show over the lock screen while an SOS launched by the power-button trigger is on screen.
        setLockScreenVisibility(false);
    }

    private void handleTriggerIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        String source;
        if (PowerTriggerService.ACTION_SOS.equals(action)) source = "power";
        else if (PowerTriggerService.ACTION_MOTION.equals(action)) source = "motion";
        else return;
        intent.setAction(Intent.ACTION_MAIN); // handle each trigger exactly once (e.g. not again after rotation)
        setLockScreenVisibility(true);

        PluginHandle handle = getBridge() != null ? getBridge().getPlugin("SosTrigger") : null;
        if (handle != null && handle.getInstance() instanceof SosTriggerPlugin) {
            ((SosTriggerPlugin) handle.getInstance()).dispatchTrigger(source);
        }
    }

    private void setLockScreenVisibility(boolean show) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(show);
            setTurnScreenOn(show);
        }
    }
}
