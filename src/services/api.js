const BASE_PATH = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  const response = await fetch(`${BASE_PATH}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function listMainVersions(keyword = "", page = 0, size = 50) {
  const params = new URLSearchParams({
    page: `${page}`,
    size: `${size}`,
  });
  if (keyword) {
    params.set("keyword", keyword);
  }
  return request(`/main-versions?${params.toString()}`);
}

export async function createMainVersion(versionName, payload = {}) {
  return request(`/main-versions`, {
    method: "POST",
    body: JSON.stringify({ versionName, ...payload }),
  });
}

export async function upsertSubVersions(versionName, payload) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/sub-versions`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getMainVersionDetail(versionName) {
  return request(`/main-versions/${encodeURIComponent(versionName)}`);
}

export async function getPackagingEligibility(versionName) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/packaging-eligibility`);
}

export async function changeSubmitStatus(id, payload) {
  return request(`/sub-versions/${encodeURIComponent(id)}/submit-status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function registryHealth() {
  return request(`/health/registry`);
}

export async function sharepointHealth() {
  return request(`/health/sharepoint`);
}

export async function createPackageJob(versionName, body) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/package-job`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listPackageJobs(status) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  return request(`/package-jobs?${params.toString()}`);
}

export async function getPackageJob(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}`);
}

export async function retryPackageJob(versionName, body) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/retry`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getChangedComponents(versionName) {
  return request(`/main-versions/${encodeURIComponent(versionName)}/changed-components`);
}

export async function updateMainVersion(versionName, payload) {
  return request(`/main-versions/${encodeURIComponent(versionName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function runAdminCleanup(dryRun = true) {
  return request(`/admin/cleanup?dryRun=${dryRun}`, {
    method: "POST",
  });
}

export async function getPackageJobFiles(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/files`);
}

export async function deleteSubVersion(id) {
  return request(`/sub-versions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deletePackage(versionName) {
  return request(`/package-jobs/${encodeURIComponent(versionName)}/package`, {
    method: "DELETE",
  });
}
