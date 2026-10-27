// ─────────────────────────────────────────────
// Thème 4 — Multimédia
// ─────────────────────────────────────────────

function auditMedia(out) {
  const videos = [...document.querySelectorAll('video')].filter(isRendered);
  const audios = [...document.querySelectorAll('audio')];
  const embeds = [...document.querySelectorAll('iframe')].filter((f) => (
    /youtube|youtu\.be|vimeo|dailymotion|twitch|peertube|soundcloud|spotify|podcast/i.test(f.src || f.getAttribute('data-src') || '')
  ));

  if (!videos.length && !audios.length && !embeds.length) {
    out.na({ id: '4.1', rule: 'media-none', message: 'Aucun média temporel détecté.' });
    return;
  }

  [...videos, ...audios].forEach((media) => {
    const autoplay = media.autoplay || media.hasAttribute('autoplay');
    const muted = media.muted || media.hasAttribute('muted');
    const controls = media.hasAttribute('controls');
    const isVideo = media.localName === 'video';

    if (autoplay && !muted) {
      const entry = {
        id: '4.10', rule: 'media-autoplay-sound', element: media,
        message: `${isVideo ? 'Vidéo' : 'Son'} lancé(e) automatiquement avec le son.`,
        rationale: 'Un son déclenché automatiquement gêne la lecture par synthèse vocale.',
        remediationHint: 'Ne pas lancer de son automatiquement, ou fournir un moyen immédiat de l’arrêter.',
      };
      if (controls) out.warn({ ...entry, message: `${entry.message} Des contrôles natifs sont présents : vérifier qu’ils sont atteignables avant le son.` });
      else out.error(entry);
    }

    if (isVideo && autoplay && muted && (media.loop || media.hasAttribute('loop')) && !controls) {
      out.warn({
        id: '13.8', rule: 'media-background-loop', element: media,
        message: 'Vidéo en lecture automatique et en boucle sans contrôle visible.',
        group: 'media-background-loop',
        remediationHint: 'Fournir un bouton pause ou arrêter la vidéo après 5 secondes.',
      });
      return;
    }

    if (!controls && !autoplay) {
      out.warn({
        id: '4.11', rule: 'media-controls', element: media,
        message: 'Média sans contrôles natifs : vérifier les contrôles personnalisés au clavier.',
        group: 'media-controls',
        remediationHint: 'Utiliser l’attribut controls ou des boutons accessibles au clavier.',
      });
    }

    if (isVideo) {
      const captions = media.querySelector('track[kind="captions"], track[kind="subtitles"]');
      if (!captions) {
        out.warn({
          id: '4.3', rule: 'video-captions', element: media,
          message: 'Vidéo sans piste de sous-titres (track kind="captions").',
          group: 'video-captions',
          rationale: 'Une vidéo comportant de la parole doit être sous-titrée ; une vidéo muette n’en a pas besoin.',
          remediationHint: 'Ajouter <track kind="captions" srclang="fr"> ou des sous-titres incrustés.',
        });
      } else {
        out.pass({
          id: '4.3', rule: 'video-captions-ok', element: media,
          message: 'Vidéo avec piste de sous-titres.',
          group: 'video-captions-ok',
          manualReviewRecommended: true, confidence: 'medium',
        });
      }
    }
  });

  if (embeds.length) {
    out.manual({
      id: '4.3', rule: 'media-embed-captions',
      message: `${embeds.length} média(s) embarqué(s) (YouTube, Vimeo…) : sous-titres à vérifier.`,
      remediationHint: 'Vérifier la présence de sous-titres relus (pas seulement automatiques).',
    });
  }
  out.manual({
    id: '4.1', rule: 'media-transcript',
    message: 'Transcription textuelle ou audiodescription : vérification manuelle.',
  });
  out.manual({
    id: '4.5', rule: 'media-audiodescription',
    message: 'Audiodescription synchronisée : vérification manuelle.',
  });
}
