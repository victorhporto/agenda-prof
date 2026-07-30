import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgendaProf",
    short_name: "AgendaProf",
    description:
      "Agenda para professores autônomos: pacotes, aulas e remarcações.",
    start_url: "/agenda",
    display: "standalone",
    background_color: "#D4EEF8",
    theme_color: "#0f6b4c",
    orientation: "portrait-primary",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
