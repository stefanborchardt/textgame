import json
import nltk
import os
import fileinput


tknzr = nltk.TweetTokenizer()
# tknzr = nltk.WordPunctTokenizer()


def filterStopWords(tokenList):
    stop_words = nltk.corpus.stopwords.words("english")
    return [w.lower() for w in tokenList if (w.lower() not in stop_words)]


# we will collect some statistics in this dictionary
game_stats = {"high_score": {"all_tokens": [],
                             "tokens": {},
                             "msg_counts": {},
                             "turn_counts": {},
                             "game_durations": {},
                             "msg_tokens_counts": [],
                             "game_count": {}
                             },
              "low_score": {"all_tokens": [],
                            "game_count": {}
                            },
              }

os.chdir('postprocessing/keep')
files = os.listdir()
print(len(files))
with fileinput.input(files) as f:
    # because some aspects of the game become known only
    # after the messages are read (e.g. selection, score)
    # we accumulate data in these vars first
    id_map = {}
    cur_game = ''
    msg_token_counts = []
    prev_msg_count_A = 0
    prev_msg_count_B = 0
    all_tokens = []
    tokens = {}
    cur_tokens = []  # tokens since last selection
    for ln in f:
        line = json.loads(ln)
        if "for" in line:
            # image id to file name mapping
            id_map = line
            cur_game = line["for"].split(":")[0]
        if "txt" in line:
            # a message
            tks = tknzr.tokenize(line["txt"])
            msg_token_counts.append(len(tks))
            cur_tokens += tks
            all_tokens += tks
            if line["role"] == "A":
                prev_msg_count_A = line["playerMsgNumber"]
            else:
                prev_msg_count_B = line["playerMsgNumber"]
        if "currentEvent" in line:
            cur_evt = line["currentEvent"]
            evt_key = list(cur_evt.keys())[0]
            if evt_key != "undo" and evt_key != "joker":
                # image selection, tokens since last selection
                # are put into category of image and game level
                category = id_map[evt_key].split("/")[0]
                tokens[category] = tokens.get(category, []) + cur_tokens
                tokens[cur_game] = tokens.get(cur_game, []) + cur_tokens
                cur_tokens = []
        if "score" in line:
            # end of game
            if line["score"] >= 80:
                game_stats["high_score"]["game_count"][cur_game] = 1 + game_stats["high_score"]["game_count"].get(
                    cur_game, 0)
                game_stats["high_score"]["all_tokens"].extend(
                    filterStopWords(all_tokens))
                game_stats["high_score"]["msg_tokens_counts"].extend(
                    msg_token_counts)
                game_stats["high_score"]["msg_counts"][cur_game] = game_stats["high_score"]["msg_counts"].get(
                    cur_game, []) + [prev_msg_count_A]
                game_stats["high_score"]["msg_counts"][cur_game] = game_stats["high_score"]["msg_counts"].get(
                    cur_game, []) + [prev_msg_count_B]
                game_stats["high_score"]["turn_counts"][cur_game] = game_stats["high_score"]["turn_counts"].get(
                    cur_game, []) + [line["turnCount"]]
                game_stats["high_score"]["game_durations"][cur_game] = game_stats["high_score"]["game_durations"].get(
                    cur_game, []) + [line["gameSecs"]]
                for k in tokens:
                    game_stats["high_score"]["tokens"][k] = game_stats["high_score"]["tokens"].get(
                        k, []) + filterStopWords(tokens[k])

            else:
                game_stats["low_score"]["game_count"][cur_game] = 1 + game_stats["low_score"]["game_count"].get(
                    cur_game, 0)
                game_stats["low_score"]["all_tokens"].extend(
                    filterStopWords(all_tokens))


print("total tokens {0}".format(len(
    game_stats["high_score"]["all_tokens"]) + len(game_stats["low_score"]["all_tokens"])))
print("distinct tokens {0}".format(len(set(
    game_stats["high_score"]["all_tokens"] + game_stats["low_score"]["all_tokens"]))))
print("number of games: high score {0} / low score {1}".format(
    game_stats["high_score"]["game_count"], game_stats["low_score"]["game_count"]))

# msglenfd = nltk.FreqDist(game_stats["high_score"]["msg_tokens_counts"])
# msglenfd.plot(50, cumulative=False, title="Tokens / Message")

# fd = nltk.FreqDist(game_stats["high_score"]["all_tokens"])
# fd.plot(50, cumulative=False, title="All Tokens")

# fd1 = nltk.FreqDist(game_stats["high_score"]["tokens"]["berry"])
# fd1.plot(50, cumulative=False, title="Tokens for Berries")
fd2 = nltk.FreqDist(game_stats["high_score"]["tokens"]["dog"])
fd2.plot(50, cumulative=False, title="Tokens for Dogs")
# fd3 = nltk.FreqDist(game_stats["high_score"]["tokens"]["flower"])
# fd3.plot(50, cumulative=False, title="Tokens for Flowers")
# fd4 = nltk.FreqDist(game_stats["high_score"]["tokens"]["bird"])
# fd4.plot(50, cumulative=False, title="Tokens for Birds")

# fdg1 = nltk.FreqDist(game_stats["high_score"]["tokens"]["first"])
# fdg1.plot(50, cumulative=False)
# fdg2 = nltk.FreqDist(game_stats["high_score"]["tokens"]["second"])
# fdg2.plot(50, cumulative=False)

# bg = nltk.collocations.BigramCollocationFinder.from_words(filtered_tokens["berry"])
# bg.ngram_fd.plot(50, cumulative=False)
