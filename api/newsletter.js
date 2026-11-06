// Newsletter-Anmeldung: Website → diese Funktion → Brevo Double-Opt-in.
// Das sibforms-Formular von Brevo hat neue Adressen still verworfen (06.11.2026),
// die offizielle Schnittstelle verschickt die Bestätigungsmail zuverlässig.
// Der Schlüssel liegt nur als Umgebungsvariable BREVO_API_KEY bei Vercel.

const LISTE_NEWSLETTER = 2;      // Brevo-Liste "Newsletter"
const VORLAGE_DOI = 1;           // Standard-Template Double-Opt-in
const ZIEL_NACH_BESTAETIGUNG = 'https://www.astro-johnny.com/?angemeldet=1#newsletter';
const ERLAUBTE_HERKUNFT = ['https://www.astro-johnny.com', 'https://astro-johnny.com'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false });
    return;
  }

  const herkunft = req.headers.origin || '';
  if (herkunft && !ERLAUBTE_HERKUNFT.includes(herkunft)) {
    res.status(403).json({ success: false });
    return;
  }

  let daten = req.body || {};
  if (typeof daten === 'string') {
    try { daten = JSON.parse(daten); } catch (e) { daten = {}; }
  }

  // Spam-Falle: echte Menschen sehen dieses Feld nicht. Bots bekommen "Erfolg", es passiert nichts.
  if (daten.website) {
    res.status(200).json({ success: true });
    return;
  }

  const email = String(daten.email || '').trim().toLowerCase();
  const vorname = String(daten.vorname || '').trim().slice(0, 100);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    res.status(400).json({ success: false, fehler: 'email' });
    return;
  }

  const schluessel = process.env.BREVO_API_KEY;
  if (!schluessel) {
    res.status(500).json({ success: false });
    return;
  }

  const attribute = { QUELLE: 3 }; // 3 = Website
  if (vorname) attribute.VORNAME = vorname;

  try {
    const antwort = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': schluessel, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        email,
        attributes: attribute,
        includeListIds: [LISTE_NEWSLETTER],
        templateId: VORLAGE_DOI,
        redirectionUrl: ZIEL_NACH_BESTAETIGUNG,
      }),
    });
    if (antwort.ok) {
      res.status(200).json({ success: true });
    } else {
      const text = await antwort.text();
      console.error('Brevo', antwort.status, text);
      res.status(502).json({ success: false });
    }
  } catch (e) {
    console.error('Brevo nicht erreichbar', e);
    res.status(502).json({ success: false });
  }
};
