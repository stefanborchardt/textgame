import json
import nltk

# import matplotlib.pyplot as plt

file = open("logs/postprocess.log", "r", encoding="utf-8")
tknzr = nltk.TweetTokenizer() # tokenize.WordPunctTokenizer()
tokens = []
for line in file:
    jline = json.loads(line)
    if "txt" in line:
        tokens += tknzr.tokenize(jline["txt"])
    #     print(tokens)
    # if "currentEvent" in line:
    #     curEvt = jline["currentEvent"]
    #     print(list(curEvt.keys())[0] +
    #           ": " + str(list(curEvt.values())[0]))
stop_words = nltk.corpus.stopwords.words('english')
# print(stop_words)
filtered_tokens = [w.lower() for w in tokens if (w.lower() not in stop_words)]
# print(filtered_tokens)
fd = nltk.FreqDist(filtered_tokens)
fd.plot(50,cumulative=False)
