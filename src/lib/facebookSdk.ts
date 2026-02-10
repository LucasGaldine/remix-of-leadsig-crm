declare global {
  interface Window {
    FB: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { accessToken: string; userID: string } | null; status: string }) => void,
        options?: { scope: string; auth_type?: string }
      ) => void;
      api: (
        path: string,
        method: string,
        params: Record<string, string>,
        callback: (response: { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } }) => void
      ) => void;
      getLoginStatus: (callback: (response: { status: string; authResponse?: { accessToken: string } | null }) => void) => void;
    };
    fbAsyncInit: () => void;
  }
}

export interface FbPage {
  id: string;
  name: string;
  access_token: string;
}

const FB_VERSION = "v21.0";
const FB_SCOPES = "pages_show_list,pages_read_engagement,leads_retrieval";

let sdkLoaded = false;
let sdkReady = false;
let readyPromise: Promise<void> | null = null;

export function loadFacebookSdk(appId: string): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<void>((resolve) => {
    if (sdkReady && window.FB) {
      resolve();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: FB_VERSION,
      });
      sdkReady = true;
      resolve();
    };

    if (!sdkLoaded) {
      sdkLoaded = true;
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  });

  return readyPromise;
}

export function fbLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error("Facebook SDK not loaded"));
      return;
    }

    window.FB.login(
      (response) => {
        if (response.authResponse?.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error("Facebook login was cancelled or failed"));
        }
      },
      { scope: FB_SCOPES, auth_type: "rerequest" }
    );
  });
}

export function fbGetPages(): Promise<FbPage[]> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error("Facebook SDK not loaded"));
      return;
    }

    window.FB.api(
      "/me/accounts",
      "GET",
      { fields: "id,name,access_token" },
      (response) => {
        if (response.error) {
          reject(new Error(response.error.message || "Failed to get Facebook pages"));
          return;
        }
        resolve(response.data || []);
      }
    );
  });
}
