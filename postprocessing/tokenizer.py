import json
import nltk
import os
import fileinput


tknzr = nltk.TweetTokenizer()  
# tknzr = nltk.WordPunctTokenizer()
tokens = {}
all_tokens = []
id_map = {}
cur_tokens = []  # tokens since last selection
msg_lengths = []
cur_game = ''

os.chdir('postprocessing/keep')
files = os.listdir()
with fileinput.input(files) as f:
    for l in f:
        line = json.loads(l)
        if "for" in line:
            # image id to file name mapping
            id_map = line
            cur_game = line["for"].split(":")[0]
        if "txt" in line:
            # a message
            tks = tknzr.tokenize(line["txt"])
            msg_lengths.append(len(tks))
            cur_tokens += tks
            all_tokens += tks
        if "currentEvent" in line:
            cur_evt = line["currentEvent"]
            evt_key = list(cur_evt.keys())[0]
            evt_val = list(cur_evt.values())[0]
            if evt_key != "undo" and evt_key != "joker":
                # image selection, tokens since last selection
                # are put into category of image and game level
                category = id_map[evt_key].split("/")[0]
                tokens[category] = tokens.get(category, []) + cur_tokens
                tokens[cur_game] = tokens.get(cur_game, []) + cur_tokens
                cur_tokens = []

stop_words = nltk.corpus.stopwords.words("english")
filtered_tokens = {}
for cat in tokens.keys():
    filtered_tokens[cat] = [w.lower()
                            for w in tokens[cat] if (w.lower() not in stop_words)]
all_filtered_tokens = [w.lower()
                       for w in all_tokens if (w.lower() not in stop_words)]


print("total tokens {0}".format(len(all_tokens)))
print("distinct tokens {0}".format(len(set(all_tokens))))

msglenfd = nltk.FreqDist(msg_lengths)
msglenfd.plot(50, cumulative=False)

# fd = nltk.FreqDist(all_filtered_tokens)
# fd.plot(50, cumulative=False)

# fd1 = nltk.FreqDist(filtered_tokens["berry"])
# fd1.plot(50, cumulative=False)
fd2 = nltk.FreqDist(filtered_tokens["dog"])
fd2.plot(50, cumulative=False)
# fd3 = nltk.FreqDist(filtered_tokens["flower"])
# fd3.plot(50, cumulative=False)
# fd4 = nltk.FreqDist(filtered_tokens["bird"])
# fd4.plot(50, cumulative=False)

# fdg1 = nltk.FreqDist(filtered_tokens["first"])
# fdg1.plot(50, cumulative=False)
fdg2 = nltk.FreqDist(filtered_tokens["second"])
fdg2.plot(50, cumulative=False)

# bg = nltk.collocations.BigramCollocationFinder.from_words(filtered_tokens["berry"])
# bg.ngram_fd.plot(50, cumulative=False)
