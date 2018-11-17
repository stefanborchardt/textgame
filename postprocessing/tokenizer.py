import json
import nltk
import os
import fileinput
import numpy
import matplotlib.pyplot as plt
import pandas

tknzr = nltk.TweetTokenizer()
# tknzr = nltk.WordPunctTokenizer()


def filterStopWords(tokenList):
    stop_words = nltk.corpus.stopwords.words("english")
    return [w.lower() for w in tokenList if (w.lower() not in stop_words)]


# we will collect some statistics in this dictionary
game_stats = {"all_tokens": [],
              "mid_tokens": [],  # after first selection
              "tokens": {},  # by category etc
              "msg_counts": {},
              "turn_counts": {},
              "game_durations": {},
              "msg_tokens_counts": {},
              "game_count": {}
              }


os.chdir('postprocessing/keep')
files = os.listdir()
print(len(files))
with fileinput.input(files) as file_handle:
    # because some aspects of the game become known only
    # after the messages are read (e.g. selection, score)
    # we accumulate data in these vars first
    id_map = {}
    cur_game = ''
    msg_token_counts = []
    prev_msg_count_A = 0
    prev_msg_count_B = 0
    game_tokens = []
    tokens_by_cat_lvl = {}
    cur_tokens = []  # tokens since last selection
    mid_tokens = []  # tokens after first selection
    game_beginning = True
    for ln in file_handle:
        log_entry = json.loads(ln)
        if "for" in log_entry:
            # image id to file name mapping
            id_map = log_entry
            cur_game = log_entry["for"].split(":")[0]
        if "txt" in log_entry:
            # a message
            tks = tknzr.tokenize(log_entry["txt"])
            msg_token_counts.append(len(tks))
            cur_tokens += tks
            game_tokens += tks
            if not game_beginning:
                mid_tokens += tks
            if log_entry["role"] == "A":
                prev_msg_count_A = log_entry["playerMsgNumber"]
            else:
                prev_msg_count_B = log_entry["playerMsgNumber"]
        if "currentEvent" in log_entry:
            cur_evt = log_entry["currentEvent"]
            evt_key = list(cur_evt.keys())[0]
            if evt_key != "undo" and evt_key != "joker":
                # image selection, tokens since last selection
                # are put into category of image and game level
                category = id_map[evt_key].split("/")[0]
                tokens_by_cat_lvl[cur_game] = tokens_by_cat_lvl.get(
                    cur_game, []) + cur_tokens
                if not game_beginning:
                    tokens_by_cat_lvl[category] = tokens_by_cat_lvl.get(
                        category, []) + cur_tokens
                    tokens_by_cat_lvl[evt_key] = tokens_by_cat_lvl.get(
                        evt_key, []) + cur_tokens
                cur_tokens = []
                game_beginning = False
        if "score" in log_entry:
            # end of game
            if log_entry["score"] >= 20:
                game_stats["game_count"][cur_game] = 1 + game_stats["game_count"].get(
                    cur_game, 0)
                game_stats["all_tokens"].extend(game_tokens)
                game_stats["mid_tokens"].extend(
                    filterStopWords(mid_tokens))
                game_stats["msg_tokens_counts"][cur_game] = game_stats["msg_tokens_counts"].get(
                    cur_game, []) + msg_token_counts
                # game_stats["msg_tokens_counts"].extend(
                #     msg_tokens_counts)
                game_stats["msg_counts"][cur_game] = game_stats["msg_counts"].get(
                    cur_game, []) + [prev_msg_count_A]
                game_stats["msg_counts"][cur_game] = game_stats["msg_counts"].get(
                    cur_game, []) + [prev_msg_count_B]
                game_stats["turn_counts"][cur_game] = game_stats["turn_counts"].get(
                    cur_game, []) + [log_entry["turnCount"]]
                game_stats["game_durations"][cur_game] = game_stats["game_durations"].get(
                    cur_game, []) + [log_entry["gameSecs"]]
                for k in tokens_by_cat_lvl:
                    game_stats["tokens"][k] = game_stats["tokens"].get(
                        k, []) + filterStopWords(tokens_by_cat_lvl[k])

            else:
                # ignore low score games
                pass


print("total tokens {0}".format(len(game_stats["all_tokens"])))
print("distinct tokens {0}".format(len(set(filterStopWords(
    game_stats["all_tokens"])))))
print("number of games: {0}".format(game_stats["game_count"]))

print(numpy.average(game_stats["game_durations"]["first"]) / 60)
print(numpy.std(game_stats["game_durations"]["first"]) / 60)

print(numpy.average(game_stats["turn_counts"]["second"]))
print(numpy.std(game_stats["turn_counts"]["second"]))

print(numpy.average(game_stats["msg_counts"]["second"]))
print(numpy.std(game_stats["msg_counts"]["second"]))

print(numpy.average(game_stats["msg_tokens_counts"]["first"]))
print(numpy.std(game_stats["msg_tokens_counts"]["first"]))

# msg_tkn_counts = game_stats["msg_tokens_counts"]["first"] + game_stats["msg_tokens_counts"]["second"]
# plt.hist(msg_tkn_counts, bins=max(msg_tkn_counts), histtype="step")

# plt.ylabel('Count')
# plt.xlabel('Tokens per Message')
# plt.xlim(1, 22)
# plt.xticks([1,3,5,7,10,15,20])
# plt.show()

mid_tokens = pandas.Series([t for t in game_stats["mid_tokens"] if len(t) > 2])
# plt.ylabel('Count')
# plt.xlabel('Tokens')
# top_30 = mid_tokens.value_counts()[:30]
# plt.xticks(range(30), rotation=70, fontsize=12, labels=top_30.keys().values)
# plt.plot(top_30)
# plt.show()

freq = pandas.DataFrame(mid_tokens.value_counts(),
                        columns=["md_count"])
num_md_tokens = freq["md_count"].sum()
freq["rel_freq"] = freq["md_count"] / num_md_tokens


def add_column(df, img_class):
    br_tokens = pandas.Series(
        [t for t in game_stats["tokens"][img_class] if len(t) > 2])
    df[img_class+"_count"] = br_tokens.value_counts()
    num_br_tokens = df[img_class+"_count"].sum()
    df[img_class+"_freq"] = df[img_class+"_count"] / num_br_tokens
    df[img_class+"_diff"] = df[img_class+"_freq"] - freq["rel_freq"]
    return df[df[img_class+"_diff"] > 0].sort_values(img_class+"_diff", ascending=False)


print(add_column(freq, "berry")[:10])
print(add_column(freq, "dog")[:10])
print(add_column(freq, "flower")[:10])
print(add_column(freq, "bird")[:10])

pass
