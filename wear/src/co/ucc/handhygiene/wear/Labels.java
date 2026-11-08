package co.ucc.handhygiene.wear;

import java.util.HashMap;
import java.util.Map;

/* One table for every visible string. The key is the language ("en" | "es")
   sent by the desktop app; anything else falls back to English. */
final class Labels {
    static final String EN = "en";
    static final String ES = "es";

    static final String APP_NAME = "appName";
    static final String YES = "yes";
    static final String NO = "no";
    static final String ALREADY = "already";
    static final String NOTED = "noted";
    static final String STAYS = "stays";
    static final String IDLE = "idle";
    static final String MOMENTS = "moments";
    static final String SHIFT = "shift";

    private static final Map<String, String[]> TABLE = new HashMap<>();

    static {
        put(APP_NAME, "Hand Hygiene", "Higiene de Manos");
        put(YES, "Yes, I did", "Sí, me lavé");
        put(NO, "Couldn't", "No alcancé");
        put(ALREADY, "Already did it", "Ya lo hice");
        put(NOTED, "Noted. Thanks.", "Anotado. Gracias.");
        put(STAYS, "Stays with you.", "Queda solo para ti.");
        put(IDLE, "Waiting for the shift", "Esperando el turno");
        put(MOMENTS, "Moments", "Momentos");
        put(SHIFT, "Shift · Unit 4B", "Turno · Unidad 4B");
    }

    private Labels() { }

    private static void put(String key, String en, String es) {
        TABLE.put(key, new String[]{en, es});
    }

    static String normalize(String lang) {
        return ES.equals(lang) ? ES : EN;
    }

    static String get(String lang, String key) {
        String[] pair = TABLE.get(key);
        if (pair == null) return "";
        return ES.equals(lang) ? pair[1] : pair[0];
    }
}
