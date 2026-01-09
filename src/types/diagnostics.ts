export interface VSCodeDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 1 | 2 | 3 | 4; // Error=1, Warning=2, Information=3, Hint=4
  message: string;
  source?: string;
  code?: string | number;
}
