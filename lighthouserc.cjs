module.exports = {
  ci: {
    collect: {
      // URLs auditées — pages clés desktop + mobile (mobile via preset Lighthouse).
      url: [
        "https://medikong-deal-finder.lovable.app/",
        "https://medikong-deal-finder.lovable.app/catalogue",
        "https://medikong-deal-finder.lovable.app/marques",
        "https://medikong-deal-finder.lovable.app/categories",
        "https://medikong-deal-finder.lovable.app/promotions",
      ],
      numberOfRuns: 2,
      settings: {
        // Le preset est surchargé par la matrice du workflow GitHub Actions
        // (--preset=desktop pour le run desktop). Par défaut : mobile.
        preset: "mobile",
        chromeFlags: "--no-sandbox --headless=new",
        // Throttling par défaut Lighthouse (Slow 4G mobile / desktop simulation).
      },
    },
    assert: {
      // Seuils volontairement souples au démarrage : on suit la tendance
      // sans bloquer le déploiement. À durcir une fois la baseline connue.
      assertions: {
        "categories:performance": ["warn", { minScore: 0.6 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        // Bloque les régressions évidentes sur le Largest Contentful Paint
        // et le Cumulative Layout Shift (clé pour le responsive).
        "largest-contentful-paint": ["warn", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.25 }],
      },
    },
    upload: {
      // Stockage public temporaire des rapports HTML (URL partageable ~7 jours).
      // Pour basculer sur un serveur LHCI privé : remplacer par target: "lhci"
      // et fournir LHCI_SERVER_BASE_URL + LHCI_TOKEN en secrets.
      target: "temporary-public-storage",
    },
  },
};
