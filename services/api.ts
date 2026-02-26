import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: (headers) => {
      return headers;
    },
  }),
  tagTypes: ["User", "Chat"],
  endpoints: () => ({}),
});
