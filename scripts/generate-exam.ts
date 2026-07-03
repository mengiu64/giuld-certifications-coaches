const certificationId = process.argv[2] ?? 'SAP-C02';
const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000/api';

const run = async (): Promise<void> => {
  const response = await fetch(`${baseUrl}/exams/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ certificationId }),
  });
  const payload = await response.text();
  console.log(payload);
  if (!response.ok) {
    process.exitCode = 1;
  }
};

void run();
