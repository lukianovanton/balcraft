package com.gearhaven.chicken;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Talks to the Gearhaven "brain" (a local HTTP server the launcher runs, which
 * holds the API key and calls the LLM). Fully async — never blocks the server
 * thread.
 */
public final class ChickenBrain {
    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    /** Where the launcher hosts the brain. */
    public static final String URL = "http://127.0.0.1:25599/chicken";

    public static final class Response {
        public String say = null;
        public String action = "idle";       // idle|come|follow|goto|attack
        public String target = null;         // player name, if any
    }

    public static CompletableFuture<Response> think(JsonObject payload) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(URL))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload)))
                .build();
        return HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .thenApply(resp -> {
                    if (resp.statusCode() / 100 != 2) return null;
                    try {
                        return GSON.fromJson(resp.body(), Response.class);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .exceptionally(e -> null);
    }
}
