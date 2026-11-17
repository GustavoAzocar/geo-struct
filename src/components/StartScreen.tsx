import {
  ArrowUpRight,
  FilePlus2,
  FolderOpen,
  RotateCcw,
  Mountain,
  Layers3,
  Waves,
} from "lucide-react";
import type { Project } from "../domain/model";
export function StartScreen({
  onNew,
  onOpen,
  onExample,
  onRecover,
  recovery,
}: {
  onNew: () => void;
  onOpen: () => void;
  onExample: () => void;
  onRecover: () => void;
  recovery: { project: Project; savedAt: string } | null;
}) {
  return (
    <main className="start-screen">
      <div className="start-copy">
        <div className="eyebrow">OPENSTRUCT · ENGENHARIA ABERTA</div>
        <h1>
          Geo<span>Struct</span>
        </h1>
        <p className="start-subtitle">
          Cada análise começa
          <br />
          com um bom modelo.
        </p>
        <p className="start-description">
          Modele o terreno, organize os solos e represente as condições da sua
          seção geotécnica.
        </p>
        <div className="start-actions">
          <button className="primary" onClick={onNew}>
            <FilePlus2 size={18} />
            Novo projeto
          </button>
          <button className="secondary" onClick={onOpen}>
            <FolderOpen size={18} />
            Abrir projeto
          </button>
        </div>
        <button className="example-link" onClick={onExample}>
          Explorar um exemplo <ArrowUpRight size={18} />
        </button>
        {recovery && (
          <button className="recovery-card" onClick={onRecover}>
            <RotateCcw size={19} />
            <span>
              <strong>Recuperar trabalho local</strong>
              <small>
                {recovery.project.name} ·{" "}
                {new Date(recovery.savedAt).toLocaleString("pt-BR")}
              </small>
            </span>
          </button>
        )}
        <div className="start-features">
          <span>
            <Mountain size={17} />
            Seções 2D
          </span>
          <span>
            <Layers3 size={17} />
            Múltiplos solos
          </span>
          <span>
            <Waves size={17} />
            Água e cargas
          </span>
        </div>
        <p className="start-stage">
          Versão 0.1 · Modelagem
          <br />O cálculo de estabilidade será incorporado em uma próxima etapa.
        </p>
      </div>
    </main>
  );
}
