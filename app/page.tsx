"use client";

import NotionParser from "./notion";
export default function Home() {
  const elements = NotionParser.ParseNotion();
  return (
    <main>
      <div className="column">
        <h1>m5b6</h1>
        <small>
          last updated: {NotionParser.lastUpdated}
        </small>

        <div className="links">
          <a target="_blank" href="https://twitter.com/matiasberrioss">
            twitter
          </a>
          |
          <a target="_blank" href="https://linkedin.com/in/matiasberrios">
            linkedin
          </a>
          |
          <a target="_blank" href="https://github.com/m5b6">
            github
          </a>
        </div>
        <p>
          engineer & researcher from Chile, with an interest in healthcare
          applied AI. 
          <br></br>
          these are my notes on various topics, related and unrelated to my work.
        </p>


        {elements}
      </div>
    </main>
  );
}
