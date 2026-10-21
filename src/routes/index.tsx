import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corretor Oscar | Imóveis de Alto Padrão" },
      { name: "description", content: "Corretor Oscar: imóveis selecionados à venda." },
      { property: "og:title", content: "Corretor Oscar | Imóveis de Alto Padrão" },
      { property: "og:description", content: "Corretor Oscar: imóveis selecionados à venda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/oscar/index.html");
  }, []);
  return null;
}
