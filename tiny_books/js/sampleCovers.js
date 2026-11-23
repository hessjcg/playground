(function (global) {
  'use strict';

  const TinyBooks = (global.TinyBooks = global.TinyBooks || {});

  const SAMPLE_SPECS = [
    {
      title: 'The Starlight Atlas',
      author: 'E. Vance',
      bg: '#14213d',
      accent: '#fca311',
      text: '#f8f9fa',
      copies: 1,
      motif: 'compass'
    },
    {
      title: 'Botanical Field Notes',
      author: 'M. Lin',
      bg: '#249ea0',
      accent: '#f4f9f9',
      text: '#0b2b2c',
      copies: 2,
      motif: 'arch'
    },
    {
      title: 'Clay & Kiln',
      author: 'R. Alvarez',
      bg: '#b94a2c',
      accent: '#f7ede2',
      text: '#fff9f2',
      copies: 1,
      motif: 'bands'
    }
  ];

  function renderSampleCoverDataUrl(spec) {
    const w = 560;
    const h = 700;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = spec.bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle decorative frame
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(32, 32, w - 64, h - 64);

    if (spec.motif === 'compass') {
      ctx.beginPath();
      ctx.arc(w / 2, 430, 105, 0, Math.PI * 2);
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w / 2, 305);
      ctx.lineTo(w / 2 + 24, 430);
      ctx.lineTo(w / 2, 555);
      ctx.lineTo(w / 2 - 24, 430);
      ctx.closePath();
      ctx.fillStyle = spec.accent;
      ctx.fill();
    } else if (spec.motif === 'arch') {
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(w / 2, 420, 110, Math.PI, 0);
      ctx.lineTo(w / 2 + 110, 560);
      ctx.lineTo(w / 2 - 110, 560);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = spec.bg;
      ctx.beginPath();
      ctx.arc(w / 2, 440, 46, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = spec.accent;
      ctx.fillRect(72, 350, w - 144, 24);
      ctx.fillRect(72, 396, w - 144, 12);
      ctx.fillRect(72, 428, w - 144, 42);
      ctx.fillRect(72, 490, w - 144, 14);
    }

    // Cover Title
    ctx.fillStyle = spec.text;
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px Georgia, serif';
    const words = spec.title.split(' ');
    const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
    ctx.fillText(line1, w / 2, 130);
    if (line2) {
      ctx.fillText(line2, w / 2, 188);
    }

    ctx.font = '600 26px Helvetica, Arial, sans-serif';
    ctx.globalAlpha = 0.86;
    ctx.fillText(spec.author.toUpperCase(), w / 2, 622);

    return canvas.toDataURL('image/png');
  }

  TinyBooks.SampleCovers = {
    SAMPLE_SPECS,
    renderSampleCoverDataUrl
  };
})(window);
