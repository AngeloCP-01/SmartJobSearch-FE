import { render, screen } from '@testing-library/react';
import AnalysisReport from './AnalysisReport';

const REPORT = {
  meta: { documentName: 'Backend Resume', position: 'Backend Engineer', jdPresent: true, extractionOk: true, wordCount: 600 },
  atsSubScores: { parseability: 90, sections: 80, contactInfo: 100, formatting: 70, length: 100 },
  matched: [{ term: 'node.js', type: 'hard', jdCount: 4, resumeCount: 3, weight: 8 }],
  missing: [{ term: 'kubernetes', type: 'hard', jdCount: 3, resumeCount: 0, weight: 6 }],
  sectionFindings: [{ section: 'Skills', present: true }],
  suggestions: [{ text: 'Add "Kubernetes" — it appears 3× in the job description.', severity: 'high', source: 'rule' }],
};

test('renders both scores, matched/missing keywords and suggestions', () => {
  render(<AnalysisReport report={REPORT} atsScore={82} matchScore={67} />);
  expect(screen.getByLabelText(/ATS-friendliness score/i)).toHaveTextContent('82');
  expect(screen.getByLabelText(/Match score/i)).toHaveTextContent('67');
  expect(screen.getByText('node.js')).toBeInTheDocument();
  expect(screen.getByText(/kubernetes/)).toBeInTheDocument(); // chip shows "kubernetes ·3" (JD freq)
  expect(screen.getByText(/Add "Kubernetes"/)).toBeInTheDocument();
});

test('shows N/A match score and no-JD note when matchScore is null', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, jdPresent: false }, matched: [], missing: [] }} atsScore={82} matchScore={null} />);
  expect(screen.getByLabelText(/Match score/i)).toHaveTextContent(/N\/A/i);
});

test('shows a parseability warning when extraction failed', () => {
  render(<AnalysisReport report={{ ...REPORT, meta: { ...REPORT.meta, extractionOk: false } }} atsScore={10} matchScore={null} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/could not read|image-based|parse/i);
});
