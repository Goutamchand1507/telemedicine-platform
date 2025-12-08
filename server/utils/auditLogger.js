const { db } = require('../config/database');

/**
 * Log audit events for HIPAA compliance and security monitoring
 * @param {Object} eventData - The audit event data
 * @param {string} eventData.userId - User ID who performed the action
 * @param {string} eventData.action - Action performed (login, logout, create, update, delete, view)
 * @param {string} eventData.resourceType - Type of resource (user, appointment, prescription, etc.)
 * @param {string} eventData.resourceId - ID of the resource
 * @param {string} eventData.ipAddress - IP address of the user
 * @param {string} eventData.userAgent - User agent string
 * @param {Object} eventData.additionalData - Additional data to log
 */
async function logAuditEvent(eventData) {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      additionalData = {}
    } = eventData;

    // Validate required fields
    if (!action || !resourceType) {
      console.error('Audit log: Missing required fields');
      return;
    }

    await db('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: additionalData.oldValues || null,
      new_values: additionalData.newValues || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date()
    });

    console.log(`Audit log: ${action} on ${resourceType} by user ${userId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw error to avoid breaking the main flow
  }
}

/**
 * Get audit logs with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {number} page - Page number
 * @param {number} limit - Number of records per page
 */
async function getAuditLogs(filters = {}, page = 1, limit = 50) {
  try {
    const offset = (page - 1) * limit;
    
    let query = db('audit_logs')
      .select(
        'audit_logs.*',
        'users.email as user_email',
        'users.first_name',
        'users.last_name'
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .orderBy('audit_logs.timestamp', 'desc');

    // Apply filters
    if (filters.userId) {
      query = query.where('audit_logs.user_id', filters.userId);
    }
    
    if (filters.action) {
      query = query.where('audit_logs.action', filters.action);
    }
    
    if (filters.resourceType) {
      query = query.where('audit_logs.resource_type', filters.resourceType);
    }
    
    if (filters.resourceId) {
      query = query.where('audit_logs.resource_id', filters.resourceId);
    }
    
    if (filters.startDate) {
      query = query.where('audit_logs.timestamp', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('audit_logs.timestamp', '<=', filters.endDate);
    }

    // Get total count with a separate simpler query
    let countQuery = db('audit_logs').count('* as count');

    if (filters.userId) {
      countQuery = countQuery.where('audit_logs.user_id', filters.userId);
    }

    if (filters.action) {
      countQuery = countQuery.where('audit_logs.action', filters.action);
    }

    if (filters.resourceType) {
      countQuery = countQuery.where('audit_logs.resource_type', filters.resourceType);
    }

    if (filters.resourceId) {
      countQuery = countQuery.where('audit_logs.resource_id', filters.resourceId);
    }

    if (filters.startDate) {
      countQuery = countQuery.where('audit_logs.timestamp', '>=', filters.startDate);
    }

    if (filters.endDate) {
      countQuery = countQuery.where('audit_logs.timestamp', '<=', filters.endDate);
    }

    const total = await countQuery.first();
    const totalCount = parseInt(total.count);

    // Get paginated results
    const logs = await query.limit(limit).offset(offset);

    return {
      logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw error;
  }
}

/**
 * Get audit logs for a specific user
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Number of records per page
 */
async function getUserAuditLogs(userId, page = 1, limit = 50) {
  return getAuditLogs({ userId }, page, limit);
}

/**
 * Get audit logs for a specific resource
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {number} page - Page number
 * @param {number} limit - Number of records per page
 */
async function getResourceAuditLogs(resourceType, resourceId, page = 1, limit = 50) {
  return getAuditLogs({ resourceType, resourceId }, page, limit);
}

/**
 * Clean up old audit logs (for data retention policies)
 * @param {number} daysToKeep - Number of days to keep logs
 */
async function cleanupOldAuditLogs(daysToKeep = 2555) { // 7 years default for HIPAA
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deletedCount = await db('audit_logs')
      .where('timestamp', '<', cutoffDate)
      .del();

    console.log(`Cleaned up ${deletedCount} old audit logs`);
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old audit logs:', error);
    throw error;
  }
}

module.exports = {
  logAuditEvent,
  getAuditLogs,
  getUserAuditLogs,
  getResourceAuditLogs,
  cleanupOldAuditLogs
};
