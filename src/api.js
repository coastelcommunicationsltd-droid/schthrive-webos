const API_URL =
  import.meta.env.VITE_API_URL || 'https://schthrive.btlbsw.co.uk';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;

  if (response.status !== 204) {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `HTTP ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export async function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function getCurrentUser() {
  return request('/api/auth/me');
}

export async function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
  });
}

export async function changePassword(currentPassword, newPassword) {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });
}

export async function salesCoach(payload) {
  return request('/api/sales-coach', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function selectData({
  table,
  columns = ['*'],
  filters = [],
  order = null,
  limit = null,
  offset = null,
  countOnly = false,
}) {
  return request('/api/data/select', {
    method: 'POST',
    body: JSON.stringify({
      table,
      columns,
      filters,
      order,
      limit,
      offset,
      countOnly,
    }),
  });
}

function parseColumns(columns) {
  if (Array.isArray(columns)) return columns;
  const text = String(columns ?? '*').trim();
  if (!text || text === '*') return ['*'];
  return text.split(',').map((c) => c.trim()).filter(Boolean);
}

class ApiQueryBuilder {
  constructor(table) {
    this.table = table;
    this.operation = 'select';
    this.columns = ['*'];
    this.filters = [];
    this.orderSpec = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.countOnly = false;
    this.returning = ['*'];
    this.singleMode = null;
  }

  select(columns = '*', options = {}) {
    const parsed = parseColumns(columns);
    if (this.operation === 'select') {
      this.columns = parsed;
      this.countOnly = options?.head === true && options?.count === 'exact';
    } else {
      this.returning = parsed;
    }
    return this;
  }

  insert(rows) { this.operation = 'insert'; this.rows = rows; return this; }
  update(patch) { this.operation = 'update'; this.patch = patch; return this; }
  delete() { this.operation = 'delete'; return this; }
  upsert(row, options = {}) {
    this.operation = 'upsert';
    this.row = row;
    this.conflict = String(options.onConflict || '').split(',').map((x) => x.trim()).filter(Boolean);
    return this;
  }

  eq(column, value) { this.filters.push({ column, op: 'eq', value }); return this; }
  ilike(column, value) { this.filters.push({ column, op: 'ilike', value }); return this; }
  is(column, value) {
    if (value !== null) throw new Error('API adapter currently supports .is(column, null) only');
    this.filters.push({ column, op: 'isnull' });
    return this;
  }
  order(column, options = {}) { this.orderSpec = { column, ascending: options.ascending !== false }; return this; }
  limit(n) { this.limitValue = n; return this; }
  range(from, to) { this.offsetValue = from; this.limitValue = Math.max(0, to - from + 1); return this; }
  single() { this.singleMode = 'single'; return this.execute(); }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this.execute(); }

  async execute() {
    try {
      let data;
      let count = null;
      if (this.operation === 'select') {
        data = await selectData({
          table: this.table,
          columns: this.columns,
          filters: this.filters,
          order: this.orderSpec,
          limit: this.limitValue,
          offset: this.offsetValue,
          countOnly: this.countOnly,
        });
        if (this.countOnly) {
          count = data;
          data = null;
        }
      } else if (this.operation === 'insert') {
        data = await request('/api/data/insert', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, rows: this.rows, returning: this.returning }),
        });
      } else if (this.operation === 'update') {
        data = await request('/api/data/update', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, patch: this.patch, filters: this.filters, returning: this.returning }),
        });
      } else if (this.operation === 'delete') {
        data = await request('/api/data/delete', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, filters: this.filters, returning: this.returning }),
        });
      } else if (this.operation === 'upsert') {
        data = await request('/api/data/upsert', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, row: this.row, conflict: this.conflict, returning: this.returning }),
        });
      }

      if (this.singleMode === 'single') {
        if (!Array.isArray(data) || data.length !== 1) {
          return { data: null, error: { message: `Expected one row, received ${Array.isArray(data) ? data.length : 0}` }, count };
        }
        data = data[0];
      } else if (this.singleMode === 'maybeSingle') {
        if (Array.isArray(data) && data.length > 1) {
          return { data: null, error: { message: `Expected zero or one row, received ${data.length}` }, count };
        }
        data = Array.isArray(data) ? (data[0] ?? null) : data;
      }

      return { data, error: null, count };
    } catch (err) {
      return { data: null, error: { message: err?.message || String(err), status: err?.status }, count: null };
    }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

export function createApiDataClient() {
  return {
    from(table) { return new ApiQueryBuilder(table); },
    async rpc(name, args = {}) {
      try {
        const data = await request(`/api/rpc/${encodeURIComponent(name)}`, {
          method: 'POST',
          body: JSON.stringify({ args }),
        });
        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: err?.message || String(err), status: err?.status } };
      }
    },
    channel() {
      const channel = {
        on() { return channel; },
        subscribe() { return channel; },
      };
      return channel;
    },
    removeChannel() {},
  };
}
