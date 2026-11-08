package co.ucc.handhygiene.wear;

import android.content.Context;
import android.content.res.Configuration;

import java.util.Locale;

/* The watch speaks Spanish unless the desktop sends lang=en or the wearer
   picks English in Ajustes. Resource selection is forced on the activity
   context, so the device locale never decides the UI language. */
final class Lang {
    static final String ES = "es";
    static final String EN = "en";

    private Lang() { }

    static String normalize(String value) {
        return EN.equals(value) ? EN : ES;
    }

    static String lang(Context context) {
        String value = context.getSharedPreferences(BaseActivity.PREFS, Context.MODE_PRIVATE)
                .getString(BaseActivity.P_LANG, ES);
        return normalize(value);
    }

    static Context wrap(Context base) {
        Locale locale = new Locale(lang(base));
        Configuration config = new Configuration(base.getResources().getConfiguration());
        config.setLocale(locale);
        config.setLayoutDirection(locale);
        return base.createConfigurationContext(config);
    }
}
