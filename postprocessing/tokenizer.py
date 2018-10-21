import json
import nltk

file = open("logs/postprocess.log", "r", encoding="utf-8")
tknzr = nltk.TweetTokenizer()  # tokenize.WordPunctTokenizer()

tokens = {}
id_map = {}
cur_tokens = []
for l in file:
    line = json.loads(l)
    if "for" in line:
        id_map = line
    if "txt" in line:
        cur_tokens += tknzr.tokenize(line["txt"])
    if "currentEvent" in line:
        cur_evt = line["currentEvent"]
        evt_key = list(cur_evt.keys())[0]
        evt_val = list(cur_evt.values())[0]
        if evt_key != "undo" and evt_key != "joker":
            category = id_map[evt_key].split("/")[0]
            tokens[category] = cur_tokens + tokens.get(category, [])
            print("=======================")
            print(category)
            print(cur_tokens)
            cur_tokens = []

stop_words = nltk.corpus.stopwords.words("english")
filtered_tokens = {}
for cat in tokens.keys():
    filtered_tokens[cat] = [w.lower()
                            for w in tokens[cat] if (w.lower() not in stop_words)]

fd = nltk.FreqDist(filtered_tokens["berry"])
fd.plot(50, cumulative=False)
