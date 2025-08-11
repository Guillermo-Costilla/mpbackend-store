import axios from "axios"
import { config } from "../config/config.js"

export const mp = axios.create({
  baseURL: "https://api.mercadopago.com",
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${config.mercadopago.accessToken}`,
    "Content-Type": "application/json",
  },
})
