const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'SmartPark — Smart Traffic & Parking API',
    version: '1.0.0',
    description: 'Complete API documentation for Smart Traffic & Parking Management System. All requests go through the API Gateway on port 5000.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'API Gateway' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from /api/auth/login'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id:            { type: 'string' },
          name:          { type: 'string' },
          email:         { type: 'string' },
          role:          { type: 'string', enum: ['user', 'admin'] },
          phone:         { type: 'string' },
          vehicleNumber: { type: 'string' },
          vehicleType:   { type: 'string', enum: ['car', 'bike', 'truck'] }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user:  { $ref: '#/components/schemas/User' }
        }
      },
      ParkingSlot: {
        type: 'object',
        properties: {
          _id:            { type: 'string' },
          name:           { type: 'string' },
          slotCode:       { type: 'string' },
          area:           { type: 'string' },
          address:        { type: 'string' },
          totalSlots:     { type: 'integer' },
          availableSlots: { type: 'integer' },
          reservedSlots:  { type: 'integer' },
          pricePerHour:   { type: 'number' },
          status:         { type: 'string', enum: ['available', 'occupied', 'reserved', 'closed'] },
          vehicleTypes:   { type: 'array', items: { type: 'string' } },
          facilities:     { type: 'array', items: { type: 'string' } },
          rating:         { type: 'number' },
          isOperational:  { type: 'boolean' }
        }
      },
      Booking: {
        type: 'object',
        properties: {
          _id:           { type: 'string' },
          bookingId:     { type: 'string' },
          userId:        { type: 'string' },
          userName:      { type: 'string' },
          slotId:        { type: 'string' },
          slotName:      { type: 'string' },
          slotCode:      { type: 'string' },
          slotAddress:   { type: 'string' },
          vehicleNumber: { type: 'string' },
          vehicleType:   { type: 'string' },
          startTime:     { type: 'string', format: 'date-time' },
          endTime:       { type: 'string', format: 'date-time' },
          duration:      { type: 'integer' },
          totalAmount:   { type: 'number' },
          status:        { type: 'string', enum: ['confirmed', 'active', 'completed', 'cancelled'] },
          otp:           { type: 'string' },
          checkedIn:     { type: 'boolean' },
          checkedOut:    { type: 'boolean' }
        }
      },
      TrafficData: {
        type: 'object',
        properties: {
          roadName:       { type: 'string' },
          area:           { type: 'string' },
          congestionLevel:{ type: 'string', enum: ['free', 'moderate', 'heavy', 'severe'] },
          congestionScore:{ type: 'integer' },
          averageSpeed:   { type: 'number' },
          vehicleCount:   { type: 'integer' },
          incidentType:   { type: 'string' },
          timestamp:      { type: 'string', format: 'date-time' }
        }
      },
      Notification: {
        type: 'object',
        properties: {
          _id:      { type: 'string' },
          userId:   { type: 'string' },
          title:    { type: 'string' },
          message:  { type: 'string' },
          type:     { type: 'string' },
          priority: { type: 'string' },
          isRead:   { type: 'boolean' }
        }
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } }
      }
    }
  },
  paths: {

    // ─── AUTH ───────────────────────────────────────────────────────────────
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name:          { type: 'string', example: 'Priya Sharma' },
                  email:         { type: 'string', example: 'priya@example.com' },
                  password:      { type: 'string', example: 'pass1234' },
                  phone:         { type: 'string', example: '9876543210' },
                  vehicleNumber: { type: 'string', example: 'TS09AB1234' },
                  vehicleType:   { type: 'string', example: 'car' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'User registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: { description: 'Validation error or email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email:    { type: 'string', example: 'user@demo.com' },
                  password: { type: 'string', example: 'demo123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
        }
      }
    },

    '/api/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get logged-in user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized' }
        }
      },
      put: {
        tags: ['Auth'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name:          { type: 'string' },
                  phone:         { type: 'string' },
                  vehicleNumber: { type: 'string' },
                  vehicleType:   { type: 'string', enum: ['car', 'bike', 'truck'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Profile updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Unauthorized' }
        }
      }
    },

    '/api/auth/users': {
      get: {
        tags: ['Auth'],
        summary: 'Get all users (Admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of all users', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
          403: { description: 'Admin access required' }
        }
      }
    },

    // ─── PARKING SLOTS ──────────────────────────────────────────────────────
    '/api/parking/slots': {
      get: {
        tags: ['Parking Slots'],
        summary: 'Get all parking slots',
        parameters: [
          { name: 'area',        in: 'query', schema: { type: 'string' }, description: 'Filter by area name' },
          { name: 'vehicleType', in: 'query', schema: { type: 'string', enum: ['car', 'bike', 'truck'] } },
          { name: 'status',      in: 'query', schema: { type: 'string', enum: ['available', 'occupied', 'reserved'] } },
          { name: 'maxPrice',    in: 'query', schema: { type: 'number' }, description: 'Max price per hour' },
          { name: 'page',        in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',       in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: {
            description: 'Paginated list of slots',
            content: { 'application/json': { schema: { type: 'object', properties: {
              slots: { type: 'array', items: { $ref: '#/components/schemas/ParkingSlot' } },
              total: { type: 'integer' }, page: { type: 'integer' }, pages: { type: 'integer' }
            }}}}
          }
        }
      },
      post: {
        tags: ['Parking Slots'],
        summary: 'Create a new parking slot (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'area', 'address', 'totalSlots', 'pricePerHour'],
                properties: {
                  name:          { type: 'string', example: 'HITEC City Parking A' },
                  area:          { type: 'string', example: 'HITEC City' },
                  address:       { type: 'string', example: 'Plot 12, HITEC City, Hyderabad' },
                  totalSlots:    { type: 'integer', example: 100 },
                  pricePerHour:  { type: 'number', example: 30 },
                  vehicleTypes:  { type: 'array', items: { type: 'string' }, example: ['car', 'bike'] },
                  facilities:    { type: 'array', items: { type: 'string' }, example: ['CCTV', 'Security'] }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Slot created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ParkingSlot' } } } },
          400: { description: 'Validation error' }
        }
      }
    },

    '/api/parking/slots/stats': {
      get: {
        tags: ['Parking Slots'],
        summary: 'Get parking slot statistics',
        responses: {
          200: {
            description: 'Aggregated slot stats',
            content: { 'application/json': { schema: { type: 'object', properties: {
              totalSlots:     { type: 'integer' },
              availableSlots: { type: 'integer' },
              reservedSlots:  { type: 'integer' },
              totalLocations: { type: 'integer' },
              avgPrice:       { type: 'number' }
            }}}}
          }
        }
      }
    },

    '/api/parking/slots/nearby': {
      get: {
        tags: ['Parking Slots'],
        summary: 'Get nearby parking slots by coordinates',
        parameters: [
          { name: 'lat',         in: 'query', required: true,  schema: { type: 'number' }, example: 17.4435 },
          { name: 'lng',         in: 'query', required: true,  schema: { type: 'number' }, example: 78.3733 },
          { name: 'radius',      in: 'query', schema: { type: 'integer', default: 5000 }, description: 'Radius in meters' },
          { name: 'vehicleType', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of nearby slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ParkingSlot' } } } } },
          400: { description: 'lat and lng required' }
        }
      }
    },

    '/api/parking/slots/{id}': {
      get: {
        tags: ['Parking Slots'],
        summary: 'Get a parking slot by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Slot details', content: { 'application/json': { schema: { $ref: '#/components/schemas/ParkingSlot' } } } },
          404: { description: 'Slot not found' }
        }
      },
      put: {
        tags: ['Parking Slots'],
        summary: 'Update a parking slot (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isOperational: { type: 'boolean' },
                  pricePerHour:  { type: 'number' },
                  status:        { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Slot updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ParkingSlot' } } } },
          404: { description: 'Slot not found' }
        }
      },
      delete: {
        tags: ['Parking Slots'],
        summary: 'Delete a parking slot (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Slot deleted' },
          404: { description: 'Slot not found' }
        }
      }
    },

    // ─── BOOKINGS ───────────────────────────────────────────────────────────
    '/api/parking/bookings': {
      get: {
        tags: ['Bookings'],
        summary: 'Get bookings for the logged-in user',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['confirmed', 'active', 'completed', 'cancelled'] } },
          { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',  in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: { description: 'User bookings', content: { 'application/json': { schema: { type: 'object', properties: {
            bookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
            total: { type: 'integer' }
          }}}}}
        }
      },
      post: {
        tags: ['Bookings'],
        summary: 'Create a new booking',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slotId', 'vehicleNumber', 'vehicleType', 'startTime', 'endTime'],
                properties: {
                  slotId:        { type: 'string', example: '6476abc123def456' },
                  vehicleNumber: { type: 'string', example: 'TS09AB1234' },
                  vehicleType:   { type: 'string', example: 'car' },
                  startTime:     { type: 'string', format: 'date-time', example: '2026-05-04T10:00:00' },
                  endTime:       { type: 'string', format: 'date-time', example: '2026-05-04T12:00:00' },
                  userName:      { type: 'string', example: 'Priya Sharma' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Booking confirmed with OTP', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
          400: { description: 'No available slots' },
          404: { description: 'Slot not found' }
        }
      }
    },

    '/api/parking/bookings/all': {
      get: {
        tags: ['Bookings'],
        summary: 'Get all bookings system-wide (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',  in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: { description: 'All bookings', content: { 'application/json': { schema: { type: 'object', properties: {
            bookings: { type: 'array', items: { $ref: '#/components/schemas/Booking' } },
            total: { type: 'integer' }
          }}}}}
        }
      }
    },

    '/api/parking/bookings/stats': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking statistics and revenue (Admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Booking stats',
            content: { 'application/json': { schema: { type: 'object', properties: {
              byStatus: { type: 'array', items: { type: 'object', properties: { _id: { type: 'string' }, count: { type: 'integer' } } } },
              revenue:  { type: 'object', properties: { total: { type: 'number' }, count: { type: 'integer' } } }
            }}}}
          }
        }
      }
    },

    '/api/parking/bookings/{id}/cancel': {
      put: {
        tags: ['Bookings'],
        summary: 'Cancel a booking',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Booking cancelled' },
          400: { description: 'Cannot cancel completed or already cancelled booking' },
          404: { description: 'Booking not found' }
        }
      }
    },

    '/api/parking/bookings/{id}/checkin': {
      post: {
        tags: ['Bookings'],
        summary: 'Check in to a parking slot using OTP',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['otp'], properties: { otp: { type: 'string', example: '472913' } } }
            }
          }
        },
        responses: {
          200: { description: 'Check-in successful, booking status → active' },
          400: { description: 'Invalid OTP or already checked in' }
        }
      }
    },

    '/api/parking/bookings/{id}/checkout': {
      post: {
        tags: ['Bookings'],
        summary: 'Check out from parking slot',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Check-out successful, booking status → completed, slot freed' },
          400: { description: 'Not checked in yet' }
        }
      }
    },

    // ─── TRAFFIC ────────────────────────────────────────────────────────────
    '/api/traffic': {
      get: {
        tags: ['Traffic'],
        summary: 'Get latest traffic data for all roads',
        parameters: [
          { name: 'area',       in: 'query', schema: { type: 'string' }, description: 'Filter by area' },
          { name: 'congestion', in: 'query', schema: { type: 'string', enum: ['free', 'moderate', 'heavy', 'severe'] } }
        ],
        responses: {
          200: { description: 'Traffic data', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TrafficData' } } } } }
        }
      }
    },

    '/api/traffic/stats': {
      get: {
        tags: ['Traffic'],
        summary: 'Get traffic congestion level counts',
        responses: {
          200: { description: 'Congestion stats by level' }
        }
      }
    },

    '/api/traffic/nearby': {
      get: {
        tags: ['Traffic'],
        summary: 'Get traffic data near a coordinate',
        parameters: [
          { name: 'lat',    in: 'query', required: true, schema: { type: 'number' }, example: 17.4435 },
          { name: 'lng',    in: 'query', required: true, schema: { type: 'number' }, example: 78.3733 },
          { name: 'radius', in: 'query', schema: { type: 'integer', default: 4000 }, description: 'Radius in meters' }
        ],
        responses: {
          200: { description: 'Nearby traffic readings', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TrafficData' } } } } }
        }
      }
    },

    '/api/traffic/eta': {
      get: {
        tags: ['Traffic'],
        summary: 'Estimate travel time between two coordinates',
        parameters: [
          { name: 'fromLat', in: 'query', required: true, schema: { type: 'number' }, example: 17.4435 },
          { name: 'fromLng', in: 'query', required: true, schema: { type: 'number' }, example: 78.3733 },
          { name: 'toLat',   in: 'query', required: true, schema: { type: 'number' }, example: 17.3850 },
          { name: 'toLng',   in: 'query', required: true, schema: { type: 'number' }, example: 78.4867 }
        ],
        responses: {
          200: {
            description: 'ETA estimate',
            content: { 'application/json': { schema: { type: 'object', properties: {
              distance:       { type: 'number', description: 'Distance in km' },
              etaMinutes:     { type: 'integer' },
              delayMinutes:   { type: 'integer' },
              congestionScore:{ type: 'integer' },
              trafficLevel:   { type: 'string' }
            }}}}
          }
        }
      }
    },

    '/api/traffic/heatmap': {
      get: {
        tags: ['Traffic'],
        summary: 'Get heatmap data for all roads',
        responses: {
          200: {
            description: 'Heatmap points',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: {
              lat:       { type: 'number' },
              lng:       { type: 'number' },
              intensity: { type: 'number' },
              area:      { type: 'string' },
              road:      { type: 'string' }
            }}}}}
          }
        }
      }
    },

    // ─── NOTIFICATIONS ──────────────────────────────────────────────────────
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Get notifications for the logged-in user',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: { description: 'User notifications', content: { 'application/json': { schema: { type: 'object', properties: {
            notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
            unreadCount:   { type: 'integer' }
          }}}}}
        }
      },
      post: {
        tags: ['Notifications'],
        summary: 'Create a notification (internal service use)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'title', 'message', 'type'],
                properties: {
                  userId:   { type: 'string' },
                  title:    { type: 'string', example: 'Booking Confirmed!' },
                  message:  { type: 'string', example: 'Your slot at HITEC City is reserved. OTP: 472913' },
                  type:     { type: 'string', example: 'booking_confirmed' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Notification created and emitted via WebSocket' }
        }
      }
    },

    '/api/notifications/read-all': {
      put: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'All marked as read' } }
      }
    },

    '/api/notifications/{id}/read': {
      put: {
        tags: ['Notifications'],
        summary: 'Mark a single notification as read',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notification marked as read' }, 404: { description: 'Not found' } }
      }
    },

    '/api/notifications/{id}': {
      delete: {
        tags: ['Notifications'],
        summary: 'Delete a notification',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notification deleted' }, 404: { description: 'Not found' } }
      }
    }
  }
};

module.exports = swaggerSpec;
