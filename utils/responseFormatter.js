export class ApiResponse {
  static success(data = null, message = 'Success', meta = {}) {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      meta: {
        server: 'NVSURL',
        version: '1.0.0',
        ...meta
      }
    };
  }

  static error(message = 'Error', code = null, errors = null) {
    return {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      ...(code && { code }),
      ...(errors && { errors })
    };
  }

  static paginate(data, page = 1, limit = 10, total = 0) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      timestamp: new Date().toISOString()
    };
  }
}
