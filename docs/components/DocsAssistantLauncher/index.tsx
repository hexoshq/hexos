"use client";

import { useEffect, useMemo, useState } from "react";

import { AgentProvider, useAgentContext } from "@hexos/react-core";
import { AgentUIProvider, ChatWindow } from "@hexos/react-ui";
import { useRouter } from "next/router";

function SparklesIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className="docs-assistant-launcher__icon"
    >
      <path
        d="M12 3L13.77 7.23L18 9L13.77 10.77L12 15L10.23 10.77L6 9L10.23 7.23L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15L5.88 17.12L8 18L5.88 18.88L5 21L4.12 18.88L2 18L4.12 17.12L5 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 13L19.59 14.41L21 15L19.59 15.59L19 17L18.41 15.59L17 15L18.41 14.41L19 13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocsPageContextBridge() {
  const router = useRouter();

  const pageContext = useMemo(() => {
    const cleanPath = router.asPath.split("?")[0].split("#")[0];
    const segments = cleanPath.split("/").filter(Boolean);

    return {
      asPath: router.asPath,
      pathname: router.pathname,
      section: segments[0] ?? "home",
      page: segments[segments.length - 1] ?? "home",
    };
  }, [router.asPath, router.pathname]);

  useAgentContext({
    key: "docs.page-context",
    description: "Current docs page route and section.",
    value: pageContext,
    priority: 10,
    persistent: false,
  });

  return null;
}

export function DocsAssistantLauncher() {
  const router = useRouter();
  const isDocsRoute =
    router.pathname === "/docs" || router.pathname.startsWith("/docs/");
  const [isOpen, setIsOpen] = useState(false);

  const closeDrawer = () => setIsOpen(false);
  const openDrawer = () => setIsOpen(true);

  useEffect(() => {
    if (!isDocsRoute && isOpen) {
      setIsOpen(false);
    }
  }, [isDocsRoute, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen((current) => (current ? false : current));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isDocsRoute) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="docs-assistant-launcher"
          onClick={openDrawer}
          aria-label="Open Hexos assistant"
        >
          <SparklesIcon />
          <span>Ask AI</span>
        </button>
      )}

      <button
        type="button"
        className={`docs-assistant-overlay ${isOpen ? "is-open" : ""}`}
        onClick={closeDrawer}
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        aria-label="Close Hexos assistant"
      />

      <aside
        className={`docs-assistant-drawer ${isOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Hexos assistant"
        aria-hidden={!isOpen}
      >
        <div className="docs-assistant-drawer__body">
          <AgentUIProvider>
            <AgentProvider
              config={{
                endpoint: "/api/agent/chat",
                transport: "sse",
                agents: ["docs-assistant"],
                enableReasoning: true,
              }}
            >
              <DocsPageContextBridge />
              <ChatWindow
                placeholder="Ask a question..."
                header={
                  <div className="docs-assistant-header">
                    <div className="docs-assistant-header__title">
                      <SparklesIcon />
                      <strong>Assistant</strong>
                    </div>
                    <button
                      type="button"
                      className="docs-assistant-header__close"
                      onClick={closeDrawer}
                      aria-label="Close assistant"
                    >
                      x
                    </button>
                  </div>
                }
                emptyState={
                  <p className="docs-assistant-empty-state">
                    Responses are generated using AI and may contain mistakes.
                  </p>
                }
              />
            </AgentProvider>
          </AgentUIProvider>
        </div>
      </aside>
    </>
  );
}
