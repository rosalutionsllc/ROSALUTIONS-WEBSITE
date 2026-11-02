// @vitest-environment jsdom
import React from "react";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import type { PublicConfig } from "../shared/types";
import { getPublicConfig } from "../worker/config";
import type { Env } from "../worker/env";
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
const property = {
  address: "Test property Tampa FL",
  lat: 27.95,
  lng: -82.45,
  placeId: "test-place",
};
const area = {
  id: "one",
  service: "driveway",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-82.45, 27.95],
        [-82.4499, 27.95],
        [-82.4499, 27.9501],
        [-82.45, 27.9501],
        [-82.45, 27.95],
      ],
    ],
  },
};
vi.mock("../src/components/PropertyMap", () => ({
  default: ({ onPropertyChange, onAreasChange }: any) => (
    <button
      type="button"
      onClick={() => {
        onPropertyChange(property);
        onAreasChange([area]);
      }}
    >
      Select a property and draw a driveway
    </button>
  ),
}));
import Quote from "../src/pages/Quote";
let config: PublicConfig;
beforeEach(() => {
  sessionStorage.clear();
  navigate.mockClear();
  vi.stubGlobal("crypto", webcrypto);
  config = getPublicConfig({ APP_ENV: "local", EMAIL_MODE: "preview" } as Env);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Quote Test" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "quote@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "8135550123" },
  });
  fireEvent.click(screen.getByLabelText(/I agree to be contacted/));
}
it("shows a real live calculation before contact details, then submits geometry and navigates to its receipt", async () => {
  const send = vi.fn<typeof fetch>(async () =>
    Response.json({
      id: "saved",
      quoteNumber: "ROS-TEST",
      estimate: { totalCents: 24744 },
      emails: { customer: "preview", business: "preview" },
    }),
  );
  vi.stubGlobal("fetch", send);
  render(
    <BrowserRouter>
      <Quote config={config} />
    </BrowserRouter>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Email My Quote & Request Service",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Select a property and draw a driveway",
    }),
  );
  expect(
    screen.getByText("$247.44", { selector: ".estimate-total" }),
  ).toBeTruthy();
  expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
    "",
  );
  fill();
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Email My Quote & Request Service" })
      .closest("form")!,
  );
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/quote/received", expect.anything()),
  );
  const body = JSON.parse(String(send.mock.calls[0][1]?.body));
  expect(body.areas).toEqual([area]);
  expect(body.property).toEqual(property);
  expect(body.customer.email).toBe("quote@example.test");
  expect(body).not.toHaveProperty("estimate");
  expect(body).not.toHaveProperty("totalCents");
  expect(body.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
});
it("reuses the submission key after a network failure and flags special conditions for review", async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValue({ ok: true, json: async () => ({ id: "saved" }) });
  vi.stubGlobal("fetch", send);
  render(
    <BrowserRouter>
      <Quote config={config} />
    </BrowserRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Select a property and draw a driveway",
    }),
  );
  fireEvent.click(screen.getByLabelText("Rust stains"));
  expect(screen.getByText("Owner review needed")).toBeTruthy();
  fill();
  const form = screen
    .getByRole("button", { name: "Email My Quote & Request Service" })
    .closest("form")!;
  fireEvent.submit(form);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Connection lost"),
  );
  fireEvent.submit(form);
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(JSON.parse(String(send.mock.calls[0][1]?.body)).idempotencyKey).toBe(
    JSON.parse(String(send.mock.calls[1][1]?.body)).idempotencyKey,
  );
});
