﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using System.Timers;
using Common.Data;
using Common.Utils.Mongo;
using MongoDB.Bson;
using Simulation.Votes;

namespace Simulation
{
    public class SocialTestGame
    {
        private static SocialTestGame instance;
        public static SocialTestGame Instance => instance ?? (instance = new SocialTestGame());
        private Random random = new Random();


        public MongoGameStateData.GameStateData StateData { get; set; }
        public SocialTestGame()
        {
            loadGameState();
            Timer t = new Timer(TimeSpan.FromMinutes(1).TotalMilliseconds);
            t.AutoReset = true;
            t.Elapsed += progressGeneration;
            t.Start();
        }

        public void VoteAction(Vote vote)
        {
            bool found = false;
            foreach (var v in votes)
            {
                if (v.Equivalent(vote))
                {
                    found = true;
                    v.Count++;
                    break;
                }
            }
            if (!found)
            {
                vote.Count = 1;
                votes.Add(vote);
            }
        }

        private List<Vote> votes = new List<Vote>();


        private void loadGameState()
        {
            var states = MongoGameStateData.Collection.GetAll();
            MongoGameStateData.GameStateData stateData;
            if (!states.Any())
            {
                stateData = initializeGameState();
            }
            else
            {
                stateData = states[0];
            }

            StateData = stateData;
        }

        private MongoGameStateData.GameStateData initializeGameState()
        {
            MongoGameStateData.GameStateData stateData = new MongoGameStateData.GameStateData();
            stateData.Board = new MongoGameStateData.HexBoard();
            string boardStr = "";
            for (int y = 0; y < 40; y++)
            {
                for (int x = 0; x < 40; x++)
                {
                    if (random.Next(0, 100) < 15)
                    {
                        boardStr += "0";
                    }
                    else
                    {
                        boardStr += random.Next(1, 4);
                    }
                }
                boardStr += "|";
            }
            stateData.Board.BoardStr = boardStr;

            stateData.LastTick = DateTime.UtcNow.AddMinutes(1);
            stateData.Width = 10;
            stateData.Height = 10;
            stateData.Factions = new List<MongoGameStateData.GameFaction>();
            for (int f = 0; f < 3; f++)
            {
                var gameFaction = new MongoGameStateData.GameFaction();
                gameFaction.Units = new List<MongoGameStateData.GameUnit>();
                gameFaction.Id = ObjectId.GenerateNewId().ToString();

                switch (f)
                {
                    case 0:
                        gameFaction.Color = "red";
                        break;
                    case 1:
                        gameFaction.Color = "green";
                        break;
                    case 2:
                        gameFaction.Color = "blue";
                        break;
                }


                var numOfUnits = random.Next(10, 30);
                for (int i = 0; i < numOfUnits; i++)
                {
                    var unitType = random.Next(0, 100);

                    int x;
                    int y;
                    while (true)
                    {
                        x = random.Next(0, 30);
                        y = random.Next(0, 30);
                        if (!gameFaction.Units.Any(a => a.X == x && a.Y == y))
                        {
                            break;
                        }
                    }

                    MongoGameStateData.GameUnit gameUnit;

                    if (unitType < 60)
                    {
                        gameUnit = new MongoGameStateData.GameUnit()
                        {
                            Id = ObjectId.GenerateNewId().ToString(),
                            Health = 2,
                            UnitType = GameUnitType.Infantry,
                            X = x,
                            Y = y
                        };
                    }
                    else if (unitType < 90)
                    {
                        gameUnit = new MongoGameStateData.GameUnit()
                        {
                            Id = ObjectId.GenerateNewId().ToString(),
                            Health = 6,
                            UnitType = GameUnitType.Tank,
                            X = x,
                            Y = y
                        };
                    }
                    else
                    {
                        gameUnit = new MongoGameStateData.GameUnit()
                        {
                            Id = ObjectId.GenerateNewId().ToString(),
                            Health = 16,
                            UnitType = GameUnitType.Base,
                            X = x,
                            Y = y
                        };
                    }

                    gameFaction.Units.Add(gameUnit);
                }

                stateData.Factions.Add(gameFaction);
            }
            stateData.Insert();
            return stateData;
        }

        private void progressGeneration(object sender, ElapsedEventArgs e)
        {
            lock (@lock)
            {
                foreach (var unitVotes in votes.GroupBy(a => a.UnitId))
                {
                    var vote = unitVotes.OrderByDescending(a => a.Count).First();
                    vote.Complete(StateData);
                }
                votes.Clear();
                StateData.Generation += 1;
            }
        }

        private static readonly object @lock = new object();

    }

}
