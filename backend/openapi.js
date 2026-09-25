/**
 * OpenAPI 3.0 document for Swagger UI (`GET /api-docs`).
 * Keep in sync when adding or renaming routes under `backend/routes/`.
 */

/** @type {import('openapi-types').OpenAPIV3.Document} */
const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'pdfpilot API',
    version: '1.0.0',
    description:
      'Backend API for the pdfpilot PDF editor and toolkit. Most tool endpoints accept `multipart/form-data` with a PDF `file` field. Prefer the frontend app for day-to-day use; this docs UI is for developers.',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local backend' },
    { url: 'https://edit-your-pdf-1.onrender.com', description: 'Production (Render)' },
  ],
  tags: [
    { name: 'System' },
    { name: 'Core PDF' },
    { name: 'PDF Tools' },
    { name: 'Document Flow' },
    { name: 'AI' },
    { name: 'Subscription' },
    { name: 'User Sessions' },
    { name: 'Feedback' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID token (Authorization: Bearer <token>)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          ok: { type: 'boolean', example: false },
        },
      },
      Health: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          service: { type: 'string' },
          compressPdf: { type: 'string' },
          repairPdf: { type: 'string' },
          qpdf: { type: 'boolean' },
          ghostscript: { type: 'boolean' },
          ocrmypdf: { type: 'boolean' },
          subscription: { type: 'object' },
          firebaseAdminReady: { type: 'boolean' },
        },
      },
    },
    parameters: {
      sessionId: {
        name: 'sessionId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    },
    requestBodies: {
      PdfFile: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: { type: 'string', format: 'binary', description: 'PDF file' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'API home',
        description: 'HTML landing page or JSON when `Accept: application/json`.',
        responses: {
          200: { description: 'OK' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
              },
            },
          },
        },
      },
    },
    '/api-docs': {
      get: {
        tags: ['System'],
        summary: 'Swagger UI',
        description: 'Interactive OpenAPI documentation (this page).',
        responses: { 200: { description: 'Swagger UI HTML' } },
      },
    },

    '/upload': {
      post: {
        tags: ['Core PDF'],
        summary: 'Upload PDF and create edit session',
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: {
          200: { description: 'Session created' },
          400: { description: 'Invalid upload', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/edit': {
      post: {
        tags: ['Core PDF'],
        summary: 'Apply edits to a session PDF',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                  sessionId: { type: 'string' },
                  edits: { type: 'object', description: 'Editor payload (annotations, text, etc.)' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Edits applied' },
          400: { description: 'Bad request' },
          404: { description: 'Session not found' },
        },
      },
    },
    '/editor-state/{sessionId}': {
      get: {
        tags: ['Core PDF'],
        summary: 'Get editor state for a session',
        parameters: [{ $ref: '#/components/parameters/sessionId' }],
        responses: {
          200: { description: 'Editor state JSON' },
          404: { description: 'Not found' },
        },
      },
    },
    '/download': {
      get: {
        tags: ['Core PDF'],
        summary: 'Download edited PDF',
        parameters: [
          {
            name: 'sessionId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'PDF bytes',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          401: { description: 'Auth required when download auth is enabled' },
          404: { description: 'Session not found' },
        },
      },
    },
    '/pdf/{sessionId}': {
      get: {
        tags: ['Core PDF'],
        summary: 'Serve PDF for pdf.js viewer',
        parameters: [{ $ref: '#/components/parameters/sessionId' }],
        responses: {
          200: {
            description: 'PDF bytes',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          404: { description: 'Not found' },
        },
      },
    },

    '/compress-pdf': {
      get: {
        tags: ['PDF Tools'],
        summary: 'Compress PDF (method info)',
        description: 'Returns 405 — use POST.',
        responses: {
          405: { description: 'Method not allowed — use POST' },
        },
      },
      post: {
        tags: ['PDF Tools'],
        summary: 'Compress PDF (qpdf + optional Ghostscript)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  level: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    default: 'medium',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Compressed PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: { description: 'Missing/invalid file' },
          503: { description: 'qpdf not installed' },
          504: { description: 'Timed out' },
        },
      },
    },
    '/repair-pdf': {
      post: {
        tags: ['PDF Tools'],
        summary: 'Repair PDF (qpdf)',
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: {
          200: {
            description: 'Repaired PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: { description: 'Bad request' },
          503: { description: 'Tool unavailable' },
        },
      },
    },
    '/unlock-pdf': {
      post: {
        tags: ['PDF Tools'],
        summary: 'Unlock / decrypt PDF',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Unlocked PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: { description: 'Bad request / wrong password' },
          503: { description: 'Tool unavailable' },
        },
      },
    },
    '/encrypt-pdf': {
      post: {
        tags: ['PDF Tools'],
        summary: 'Encrypt PDF with password',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'password'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Encrypted PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          400: { description: 'Bad request' },
        },
      },
    },
    '/ocr-pdf': {
      post: {
        tags: ['PDF Tools'],
        summary: 'OCR PDF (Pro)',
        security: [{ bearerAuth: [] }],
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: {
          200: {
            description: 'Searchable PDF',
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          401: { description: 'Auth required' },
          403: { description: 'Pro required' },
          503: { description: 'ocrmypdf unavailable' },
        },
      },
    },

    '/document-flow/capabilities': {
      get: {
        tags: ['Document Flow'],
        summary: 'List conversion capabilities',
        responses: { 200: { description: 'Capabilities JSON' } },
      },
    },
    '/document-flow/convert-pdf-to-docx': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert PDF → DOCX',
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: { 200: { description: 'DOCX file' }, 503: { description: 'LibreOffice unavailable' } },
      },
    },
    '/document-flow/convert-pdf-to-xlsx': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert PDF → XLSX',
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: { 200: { description: 'XLSX file' } },
      },
    },
    '/document-flow/convert-pdf-to-pptx': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert PDF → PPTX',
        requestBody: { $ref: '#/components/requestBodies/PdfFile' },
        responses: { 200: { description: 'PPTX file' } },
      },
    },
    '/document-flow/convert-pptx-to-pdf': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert PPTX → PDF',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'PPTX file' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'PDF file' } },
      },
    },
    '/document-flow/convert-xlsx-to-pdf': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert XLSX → PDF',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'XLSX file' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'PDF file' } },
      },
    },
    '/document-flow/convert-html-to-pdf': {
      post: {
        tags: ['Document Flow'],
        summary: 'Convert HTML → PDF',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  html: { type: 'string' },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: { html: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'PDF file' } },
      },
    },
    '/document-flow/translate': {
      post: {
        tags: ['Document Flow'],
        summary: 'Translate document text (JSON)',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', description: 'Source text + target language' },
            },
          },
        },
        responses: { 200: { description: 'Translated payload' } },
      },
    },
    '/document-flow/session/{sessionId}/export-docx': {
      get: {
        tags: ['Document Flow'],
        summary: 'Export session as DOCX',
        parameters: [{ $ref: '#/components/parameters/sessionId' }],
        responses: { 200: { description: 'DOCX file' }, 404: { description: 'Not found' } },
      },
    },

    '/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'Chat with PDF (Pro)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  sessionId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Chat reply' },
          401: { description: 'Auth required' },
          403: { description: 'Pro required' },
        },
      },
    },
    '/ai/translate': {
      post: {
        tags: ['AI'],
        summary: 'AI translate text',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  targetLang: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Translated text' } },
      },
    },

    '/subscription/me': {
      get: {
        tags: ['Subscription'],
        summary: 'Current subscription for signed-in user',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Subscription status' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/subscription/razorpay/order': {
      post: {
        tags: ['Subscription'],
        summary: 'Create Razorpay order',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Order created' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/subscription/razorpay/verify': {
      post: {
        tags: ['Subscription'],
        summary: 'Verify Razorpay payment',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Verified' }, 400: { description: 'Invalid payment' } },
      },
    },
    '/subscription/cancel': {
      post: {
        tags: ['Subscription'],
        summary: 'Cancel subscription',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Cancelled' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/subscription/webhooks/razorpay': {
      post: {
        tags: ['Subscription'],
        summary: 'Razorpay webhook',
        description: 'Called by Razorpay — not for browser use.',
        responses: { 200: { description: 'Acknowledged' } },
      },
    },

    '/user-sessions/register': {
      post: {
        tags: ['User Sessions'],
        summary: 'Register a session in the user library',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: { 200: { description: 'Registered' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/user-sessions/duplicate': {
      post: {
        tags: ['User Sessions'],
        summary: 'Duplicate a library session',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: { 200: { description: 'Duplicated' } },
      },
    },
    '/user-sessions/library': {
      get: {
        tags: ['User Sessions'],
        summary: 'List user document library',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Library items' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/user-sessions/{sessionId}': {
      patch: {
        tags: ['User Sessions'],
        summary: 'Update library session metadata',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/sessionId' }],
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['User Sessions'],
        summary: 'Delete library session',
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/sessionId' }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },

    '/feedback': {
      get: {
        tags: ['Feedback'],
        summary: 'List public feedback',
        responses: { 200: { description: 'Feedback list' } },
      },
      post: {
        tags: ['Feedback'],
        summary: 'Submit feedback',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  rating: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Saved' }, 400: { description: 'Invalid' } },
      },
    },
    '/feedback/admin': {
      get: {
        tags: ['Feedback'],
        summary: 'Admin: list all feedback',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Admin feedback list' }, 403: { description: 'Admin only' } },
      },
      post: {
        tags: ['Feedback'],
        summary: 'Admin: mutate feedback',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' }, 403: { description: 'Admin only' } },
      },
    },
    '/feedback/admin/{id}': {
      delete: {
        tags: ['Feedback'],
        summary: 'Admin: delete feedback',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: { description: 'Deleted' }, 403: { description: 'Admin only' } },
      },
    },
  },
};

export default openApiDocument;
