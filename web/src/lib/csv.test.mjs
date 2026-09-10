import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from './csv.mjs';

test('parseCSV - simple comma separated values', () => {
  const csv = `Role,User Group,Access Level
Platform Admin,Platform Engineering,Full
Security Officer,CISO Office,Audit`;
  const result = parseCSV(csv);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], ['Role', 'User Group', 'Access Level']);
  assert.deepEqual(result[1], ['Platform Admin', 'Platform Engineering', 'Full']);
  assert.deepEqual(result[2], ['Security Officer', 'CISO Office', 'Audit']);
});

test('parseCSV - handles quoted cells with commas', () => {
  const csv = `Role,Description
SRE,"Deployment, Canary, and Rollback"
Auditor,"Read-Only, ISO 27001 Inspection"`;
  const result = parseCSV(csv);
  assert.equal(result.length, 3);
  assert.equal(result[1][1], 'Deployment, Canary, and Rollback');
  assert.equal(result[2][1], 'Read-Only, ISO 27001 Inspection');
});

test('parseCSV - handles escaped quotes inside cells', () => {
  const csv = `ID,Text
1,"He said ""Approved"" promptly"`;
  const result = parseCSV(csv);
  assert.equal(result.length, 2);
  assert.equal(result[1][1], 'He said "Approved" promptly');
});

test('parseCSV - handles empty input and CRLF line breaks', () => {
  assert.deepEqual(parseCSV(''), []);
  const crlf = "A,B\r\n1,2\r\n3,4\r\n";
  const result = parseCSV(crlf);
  assert.equal(result.length, 3);
  assert.deepEqual(result[2], ['3', '4']);
});
