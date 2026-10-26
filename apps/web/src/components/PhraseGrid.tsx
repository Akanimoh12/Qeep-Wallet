export function PhraseGrid({ phrase, hidden }: { phrase: string; hidden: boolean }) {
  const words = phrase.split(" ");
  return (
    <ol className={`phrase-grid${hidden ? " blurred" : ""}`} style={{ listStyle: "none", margin: 0 }}>
      {words.map((w, i) => (
        <li key={i} className="phrase-word">
          <span className="n">{i + 1}</span>
          <span className="w">{hidden ? "•••••" : w}</span>
        </li>
      ))}
    </ol>
  );
}
