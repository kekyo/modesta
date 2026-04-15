// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { defineConfig } from 'vitest/config';

const formatTestRunId = (value: Date) => {
  const year = value.getFullYear().toString().padStart(4, '0');
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  const seconds = `${value.getSeconds()}`.padStart(2, '0');
  const milliseconds = `${value.getMilliseconds()}`.padStart(3, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
};

process.env.MODESTA_TEST_RUN_ID ??= formatTestRunId(new Date());

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 300000,
    hookTimeout: 600000,
    include: ['tests/**/*.test.ts'],
  },
});
