# Demo — Reloj de Higiene de Manos (2 minutos)

## Arranque

Doble clic en **Hand Hygiene Watch** del dock/lanzador, o `npm start` desde
esta carpeta. Todo corre sin conexión en una sola ventana de escritorio.

## Guion del presentador

**0:00 — La tesis (guía en el reloj).** "Este reloj SE va a equivocar: una
marca equivocada es una acusación automática contra una enfermera. Por eso
todo el diseño es corregirla con un toque, sin mostrarla nunca como una
acusación." La app abre con la **Guía rápida**: tres tarjetas en el reloj
(**Guía en el reloj** · 1 de 3) — vibración, un toque responde, privacidad.
Sin formularios, sin nombres.

**0:20 — Turno guiado.** Clic en **▶ Turno guiado** (~75 s de historia).
"El reloj vibra, nunca suena: la vibración llega a la muñeca, nunca frente
al paciente." Ritmo 2: suena el recordatorio y la pantalla solo muestra
**Ya lo hice**.

**0:45 — La marca equivocada.** "Aquí está: el reloj se equivocó." La
pantalla de duda pregunta **¿Te lavaste?** con dos píldoras, sin formulario
ni campo de motivo. El dedo toca **Sí, me lavé** → brindis **Anotado.
Gracias.** "Un toque y se acabó. Nunca rojo, nunca la palabra error."

**1:10 — La pausa y la privacidad.** **Código azul** → el reloj ofrece
**Pausa 30 min** y pide confirmar con **Silenciar 30 min**, luna en la
barra de estado. "En una emergencia el reloj se calla: el aviso llega
silenciado." Clic en el **botón lateral**: **Quién ve esto** — Tú /
Control de infecciones / Nadie. "El detalle es tuyo, dura solo 24 h. La
unidad solo ve totales."

**1:35 — La página de la unidad.** Clic en **Ver lo que ve Control de
Infecciones**: barras por momento de la OMS, sin nombres. "Mide el
proceso, no a las personas." En **Pregúntale a la unidad** toca **¿Dónde
se cae el proceso?**: una línea con el momento más débil, sus números y
un arreglo de dispensador. Luego escribe *¿Qué enfermera falla más?*:
rechazo en la página, "esta vista no tiene personas". "La IA responde
sobre el proceso y no puede responder sobre una persona, porque los datos
no tienen persona." Con consentimiento (la hoja muestra los totales
exactos + la pregunta), gemma responde en ~0,5 s con la insignia
*IA · gemma*; cualquier número fuera de los totales y responden las
reglas. Calidad del modelo: "El modelo de gestos está entrenado, no
ajustado a mano: 99% en señales que nunca vio contra 98% de mis reglas
viejas. Datos sintéticos, lo digo en la página."

**1:50 — Configuración en vivo.** Abre **Configuración**: cambia **Idioma**
a **English**, toda la app cambia al instante, sin recargar. Cambia **Tema**
a **Oscuro**. "Se aplica al instante. Sin recargar." Vuelve a **Español**
y **Claro** para entregar la app como la encontraste.

## Extra: el reloj de verdad (Wear OS)

Con el emulador Wear OS la alerta abre en el reloj con su vibración real.
Hay 7 capturas en `shots/`: `wear-guide`, `wear-home`, `wear-ajustes`,
`wear-ayuda`, `wear-dudoso`, `wear-gracias`, `wear-home-en`.

```bash
npm run watch   # ~33 s en frío: arranca el emulador hhw_watch e instala y abre la app
```

El puente escritorio → reloj: en el panel **Reloj real** activa
**Enviar a mi muñeca** — ese es el único interruptor que tocas. Cada
vibración abre la alerta en el reloj con el idioma actual de la página
(es lo que verifica el paso 3: el mismo comando adb con `lang es`
muestra *¿Te lavaste?*, con `lang en` muestra *Did you wash?*). Responde
girando la corona para elegir **Sí, me lavé** / **No alcancé** y
presionando el segundo botón (o toca; flechas + Enter también sirven).
La corona como tal es Inicio en Wear OS y nunca llega a las apps.

## Antes de clase

- **Internet para el modelo**: las reglas siempre funcionan sin red; gemma
  (`gemma4:31b-cloud`) corre en ollama.com, así que sin internet las
  preguntas las responden las reglas escritas (insignia *Reglas*).
- **Borrar los datos**: en la app, Configuración → Privacidad → **Borrar
  todos los datos**; en el emulador,
  `adb -s emulator-5554 shell pm clear co.ucc.handhygiene.wear`
  (vuelve el español y la guía del primer arranque).
- **Emulador pre-arrancado**: corre `npm run watch` una vez antes de clase
  (~33 s en frío, ~1 s en caliente) y deja el reloj en Inicio.

## Si algo falla

- **Modelo caído → reglas**: si Ollama no responde, la página lo dice
  ("No pude usar el modelo; respondieron las reglas del reloj.") y sigue
  la demo sin pausa. La insignia lo deja claro.
- **Emulador trabado → scrcpy**: `scrcpy -s emulator-5554` abre un espejo
  donde la rueda del mouse es la corona y Enter confirma. Si ni eso,
  la demo entera funciona sin el emulador: el reloj simulado hace lo mismo.
