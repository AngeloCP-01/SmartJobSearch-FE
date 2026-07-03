import { describe, test, expect } from 'vitest';
import { generateJSON, generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { HeadingRule } from './headingRule';

const ext = [StarterKit, HeadingRule];

describe('HeadingRule', () => {
  test('parses data-rule into a heading rule attribute', () => {
    const json = generateJSON('<h2 data-rule="true">SUMMARY</h2>', ext);
    expect(json.content[0].attrs.rule).toBe(true);
  });
  test('renders the rule attribute back to data-rule', () => {
    const json = generateJSON('<h2 data-rule="true">SUMMARY</h2>', ext);
    expect(generateHTML(json, ext)).toContain('data-rule="true"');
  });
  test('a plain heading has rule=false and no data-rule', () => {
    const json = generateJSON('<h2>Plain</h2>', ext);
    expect(json.content[0].attrs.rule).toBe(false);
    expect(generateHTML(json, ext)).not.toContain('data-rule');
  });
});
