package co.ucc.handhygiene.wear;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

/* The Home face: a segmented shift ring (15 segments with gaps) drawn with
   Canvas, the moment count inside it, and the two labels below. It mirrors
   the desktop Home without taking any dependency. */
public class HomeView extends View {
    private static final int SEGMENTS = 15;
    private static final float GAP_DEG = 7f;

    private int done = 0;
    private int plan = 15;
    private String lang = Labels.EN;

    private final Paint segPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint numPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ofPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint captionPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF oval = new RectF();

    private final int colorLime;
    private final int colorTrack;
    private final int colorText;
    private final int colorDim;

    public HomeView(Context context) {
        super(context);
        colorLime = context.getResources().getColor(R.color.hh_lime, context.getTheme());
        colorTrack = context.getResources().getColor(R.color.hh_track, context.getTheme());
        colorText = context.getResources().getColor(R.color.hh_text, context.getTheme());
        colorDim = context.getResources().getColor(R.color.hh_text_dim, context.getTheme());
        setBackgroundColor(context.getResources().getColor(R.color.hh_black, context.getTheme()));

        segPaint.setStyle(Paint.Style.STROKE);
        segPaint.setStrokeCap(Paint.Cap.BUTT);

        numPaint.setColor(colorText);
        numPaint.setTextAlign(Paint.Align.CENTER);
        numPaint.setFakeBoldText(true);

        ofPaint.setColor(colorDim);
        ofPaint.setTextAlign(Paint.Align.CENTER);

        labelPaint.setColor(colorText);
        labelPaint.setTextAlign(Paint.Align.CENTER);

        captionPaint.setColor(colorDim);
        captionPaint.setTextAlign(Paint.Align.CENTER);
    }

    /** Last known shift state: done/plan are already clamped by the caller. */
    public void setState(int done, int plan, String lang) {
        this.done = Math.max(0, Math.min(99, done));
        this.plan = Math.max(0, Math.min(99, plan));
        this.lang = Labels.normalize(lang);
        invalidate();
    }

    private int filledSegments() {
        if (plan <= 0) return 0;
        int n = Math.round(done * SEGMENTS / (float) plan);
        return Math.max(0, Math.min(SEGMENTS, n));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        float unit = Math.min(w, h);
        float cx = w / 2f;
        /* Slightly above centre: the two labels live under the ring and must
           stay inside a round screen. */
        float cy = h * 0.40f;
        float stroke = unit * 0.07f;
        float radius = unit * 0.27f;
        float step = 360f / SEGMENTS;
        float sweep = step - GAP_DEG;
        int filled = filledSegments();

        segPaint.setStrokeWidth(stroke);
        oval.set(cx - radius, cy - radius, cx + radius, cy + radius);
        for (int i = 0; i < SEGMENTS; i++) {
            segPaint.setColor(i < filled ? colorLime : colorTrack);
            canvas.drawArc(oval, -90f + i * step, sweep, false, segPaint);
        }

        numPaint.setTextSize(unit * 0.19f);
        float numBaseline = cy + numPaint.getTextSize() * 0.34f;
        canvas.drawText(String.valueOf(done), cx, numBaseline, numPaint);

        ofPaint.setTextSize(unit * 0.075f);
        canvas.drawText("/ " + plan, cx, numBaseline + unit * 0.085f, ofPaint);

        float below = cy + radius + stroke / 2f;
        labelPaint.setTextSize(unit * 0.075f);
        canvas.drawText(Labels.get(lang, Labels.MOMENTS), cx, below + unit * 0.10f, labelPaint);

        captionPaint.setTextSize(unit * 0.058f);
        canvas.drawText(Labels.get(lang, Labels.SHIFT), cx, below + unit * 0.175f, captionPaint);
    }
}
