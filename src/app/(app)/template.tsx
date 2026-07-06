/* Wird bei jedem Seitenwechsel neu gemountet → weiches Einblenden der Seite */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
