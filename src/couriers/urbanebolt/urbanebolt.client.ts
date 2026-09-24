import { Injectable } from '@nestjs/common';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from 'axios';
import { CourierError } from '../courier.error';

@Injectable()
export class UrbaneBoltClient {
  private readonly http: AxiosInstance;

  private token: string | null = null;
  private tokenExpiresAt = 0;

  // Demo credentials only. Do NOT commit these.
  private readonly username = 'info@urbanebolt.com';
  private readonly password = 'EKIcygsLVV5RCtPZ';

  private readonly baseUrl = 'https://uat.urbanebolt.in';

  // UAT can be slower than production.
  private readonly timeoutMs = 15000;

  constructor() {
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async authenticate(): Promise<void> {
    try {
      const response = await this.http.post<{
        access_token: string;
        expires_in: number;
        token_type: string;
        expires: string;
        status: string;
      }>(
        '/api/v1/auth/getToken/',
        {
          username: this.username,
          password: this.password,
        },
      );

      const data = response.data;

      if (
        !data ||
        data.status !== 'Success' ||
        !data.access_token
      ) {
        throw new CourierError(
          'AUTH_ERROR',
          'UrbaneBolt authentication failed',
          response.status,
          data,
        );
      }

      this.token = data.access_token;

      this.tokenExpiresAt =
        Date.now() + data.expires_in * 1000 - 60_000;
    } catch (error) {
      if (error instanceof CourierError) {
        throw error;
      }

      throw this.normalizeError(error);
    }
  }

  private async getToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }

    if (!this.token) {
      throw new CourierError(
        'AUTH_ERROR',
        'UrbaneBolt authentication token unavailable',
      );
    }

    return this.token;
  }

  private async request<T>(
    config: AxiosRequestConfig,
    retryAuth = true,
  ): Promise<T> {
    const token = await this.getToken();

    try {
      const response = await this.http.request<T>({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Token expired / invalid.
      if (
        retryAuth &&
        axiosError.response?.status === 401
      ) {
        this.token = null;
        this.tokenExpiresAt = 0;

        await this.authenticate();

        return this.request<T>(config, false);
      }

      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): CourierError {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNABORTED') {
      return new CourierError(
        'TIMEOUT',
        'UrbaneBolt request timed out',
      );
    }

    if (axiosError.code === 'ETIMEDOUT') {
      return new CourierError(
        'TIMEOUT',
        'UrbaneBolt request timed out',
      );
    }

    if (!axiosError.response) {
      return new CourierError(
        'NETWORK_ERROR',
        'Unable to connect to UrbaneBolt',
      );
    }

    const statusCode = axiosError.response.status;

    if (statusCode >= 400 && statusCode < 500) {
      return new CourierError(
        'CLIENT_ERROR',
        'UrbaneBolt rejected the request',
        statusCode,
        axiosError.response.data,
      );
    }

    if (statusCode >= 500) {
      return new CourierError(
        'SERVER_ERROR',
        'UrbaneBolt service is temporarily unavailable',
        statusCode,
        axiosError.response.data,
      );
    }

    return new CourierError(
      'NETWORK_ERROR',
      'UrbaneBolt request failed',
      statusCode,
      axiosError.response.data,
    );
  }

  async manifest<T>(payload: unknown): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url: '/api/v1/services/manifest/',
      data: payload,
    });
  }

  async tracking<T>(awb: string): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url: '/api/v1/services/tracking-pub/',
      params: { awb },
    });
  }

  async cancel<T>(awb: string): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url: '/api/v1/services/cancel/',
      data: {
        awbs: awb,
      },
    });
  }
}
