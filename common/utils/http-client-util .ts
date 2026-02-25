import axios, { AxiosInstance } from 'axios';

export class HttpClientUtil {
  private static instance: AxiosInstance = axios.create({
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  static async get<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this.instance.get<T>(url, { headers });
    return response.data;
  }

  static async post<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
    const response = await this.instance.post<T>(url, body, { headers });
    return response.data;
  }
}
