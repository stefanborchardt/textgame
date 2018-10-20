import json
import nltk

file = open("logs/postprocess.log", "r", encoding="utf-8")
tknzr = nltk.tokenize.WordPunctTokenizer()  # TweetTokenizer()
for line in file:
    jline = json.loads(line)
    if "txt" in line:
        tokens = tknzr.tokenize(jline["txt"])
        print(tokens)
    if "currentEvent" in line:
        curEvt = jline["currentEvent"]
        print(list(curEvt.keys())[0] +
              ": " + str(list(curEvt.values())[0]))
