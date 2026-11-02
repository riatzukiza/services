(require '[clojure.edn :as edn]
         '[clojure.java.io :as io])
(import '[java.io PushbackReader])

(def contract-root (io/file "contracts/knoxx"))
(def eof (Object.))
(def contract-files
  (->> (file-seq contract-root)
       (filter #(.isFile %))
       (filter #(.endsWith (.getName %) ".edn"))
       (sort-by #(.getPath %))))

(when-not (.isDirectory contract-root)
  (throw (ex-info "Knoxx contract root is missing"
                  {:path (.getPath contract-root)})))
(when (empty? contract-files)
  (throw (ex-info "Knoxx contract root contains no EDN resources"
                  {:path (.getPath contract-root)})))

(doseq [contract-file contract-files]
  (try
    (with-open [reader (PushbackReader. (io/reader contract-file))]
      (when (identical? eof (edn/read {:eof eof} reader))
        (throw (ex-info "resource is empty" {})))
      (when-not (identical? eof (edn/read {:eof eof} reader))
        (throw (ex-info "resource contains more than one form" {}))))
    (catch Exception error
      (throw (ex-info (str "invalid Knoxx EDN resource "
                           (.getPath contract-file) ": "
                           (.getMessage error))
                      {:path (.getPath contract-file)}
                      error)))))

(doseq [relative-path ["agents/publication_translator.edn"
                       "agents/publication_post_drafter.edn"]]
  (let [contract-file (io/file contract-root relative-path)
        contract (edn/read-string (slurp contract-file))]
    (when-not (= :required-first (:tools/choice contract))
      (throw (ex-info (str "publication agent must set top-level "
                           ":tools/choice :required-first: "
                           (.getPath contract-file))
                      {:path (.getPath contract-file)
                       :tools/choice (:tools/choice contract)})))))

;; digitalocean/services/knoxx/probe-ollama.js sends the post-drafter canary
;; through the deployed openai-completions body, which emits `reasoning_effort`
;; only when the model declares reasoning AND compat supports the field. The
;; canary therefore omits it. check-env-contracts.py pins both publication
;; agents to this exact model id; this law keeps the declaration that makes the
;; canary's omission the production request. Flipping either flag must fail here
;; rather than silently make the health gate probe a shape production never
;; sends.
(let [contract-file (io/file contract-root "models/gemma4_e2b.edn")
      contract (edn/read-string (slurp contract-file))
      compat (:model/compat contract)
      path (.getPath contract-file)]
  (doseq [[label actual expected]
          [[":model/reasoning" (:model/reasoning contract) false]
           [":model/default-thinking" (:model/default-thinking contract) :off]
           [":model/thinking-levels" (:model/thinking-levels contract) [:off]]
           [":supportsReasoningEffort" (:supportsReasoningEffort compat) false]]]
    (when-not (= expected actual)
      (throw (ex-info (str "deployed publication-agent model must keep "
                           "reasoning disabled so the post-drafter health "
                           "canary sends the production request body: "
                           path " " label)
                      {:path path
                       :key label
                       :expected expected
                       :actual actual})))))

(println "all" (count contract-files) "Knoxx EDN resources parse as exactly one form")

;; Axxium identity seeds (AXXIUM_IDENTITY_SEED_FILE): one map, parents
;; before children, named policies resolvable, and no secret material.
(doseq [seed-file (->> (file-seq (io/file "contracts/axxium/identity"))
                       (filter #(.endsWith (.getName %) ".edn")))]
  (let [path (.getPath seed-file)
        text (slurp seed-file)
        seed (with-open [reader (PushbackReader. (java.io.StringReader. text))]
               (let [value (edn/read {:eof eof} reader)]
                 (when-not (identical? eof (edn/read {:eof eof} reader))
                   (throw (ex-info (str "invalid Axxium identity seed " path ": contains more than one form") {:path path})))
                 value))
        fail #(throw (ex-info (str "invalid Axxium identity seed " path ": " %) {:path path}))
        policy? (fn [ref]
                  (let [p (if (keyword? ref) (get (:policies seed) ref) ref)]
                    (and (map? p)
                         (= (set (keys p)) #{:policy/repos :policy/permissions :policy/actions :policy/forbid})
                         (set? (:policy/repos p))
                         (every? #(and (string? %) (pos? (count %))) (:policy/repos p))
                         (map? (:policy/permissions p))
                         (every? (fn [[k v]] (and (string? k) (contains? #{"none" "read" "write" "admin"} v))) (:policy/permissions p))
                         (set? (:policy/actions p))
                         (every? #{:read :comment :review :approve :push :merge} (:policy/actions p))
                         (set? (:policy/forbid p))
                         (every? #{:approve-own :merge-own :force-push} (:policy/forbid p)))))]
    (when-not (map? seed) (fail "not a map"))
    (when-not (policy? (get-in seed [:root :policy])) (fail "root policy unresolved"))
    (when (re-find #"(?i):credential/(secret|pem|sealed|key-file)|BEGIN [A-Z ]*PRIVATE KEY|axb_|ghs_|ghp_|github_pat_|sk-" text)
      (fail "contains secret material"))
    (reduce (fn [seen {:keys [id parent policy]}]
              (when (contains? seen id) (fail (str "duplicate actor id " id)))
              (when-not (contains? seen parent) (fail (str id " precedes its parent " parent)))
              (when-not (policy? policy) (fail (str id " policy unresolved")))
              (conj seen id))
            #{(get-in seed [:root :id])}
            (:nodes seed))))
