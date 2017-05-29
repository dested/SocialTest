import {AssetManager} from "../game/assetManager";
import {HexBoard} from "../game/hexBoard";
import {GridHexagonConstants} from "../game/gridHexagonConstants";
import {GridHexagon} from "../game/gridHexagon";
import {Vector3, HexUtils, Direction} from "../game/hexUtils";
import {GameMetricVoteAction, GameMetricMoveVoteAction, GameEntity, GameMetricsVote, GameMetricSpawnVoteAction, GameMetricAttackVoteAction} from "../models/hexBoard";
import {AnimationFrame, AnimationFrameType, AnimationType} from "../animationManager";
import {Help} from "../utils/help";
import {HexagonColorUtils} from "../utils/hexagonColorUtils";
import {PossibleActions} from "../ui/gameService";
export class EntityManager {

    constructor(public hexBoard: HexBoard) {
    }


    public entities: BaseEntity[] = [];
    private entityKeys: { [entityId: number]: BaseEntity } = {};
    private entitiesMap: { [tileKey: number]: BaseEntity[] } = {};


    tick() {
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            entity.tick();
        }
    }

    getEntitiesAtTile(item: Vector3): BaseEntity[] {
        return this.entitiesMap[item.x + item.z * 5000] || [];
    }

    addEntity(entity: BaseEntity) {
        this.entities.push(entity);
        this.entityKeys[entity.id] = entity;
    }

    empty(): void {
        this.entities.length = 0;
        this.entitiesMap = {};
        this.entityKeys = {};
    }

    getEntityById(id: string): BaseEntity {
        return this.entityKeys[id];
    }

    removeEntityFromTile(tile: GridHexagon, entity: BaseEntity): void {
        let entities = this.entitiesMap[tile.x + tile.z * 5000];
        entities.splice(entities.indexOf(entity), 1);

        this.entitiesMap[tile.x + tile.z * 5000] = entities;
    }

    killEntity(entity: BaseEntity): void {
        var tile = entity.getTile();

        let entities = this.entitiesMap[tile.x + tile.z * 5000];
        entities.splice(entities.indexOf(entity), 1);

        this.entitiesMap[tile.x + tile.z * 5000] = entities;
        this.entities.splice(this.entities.indexOf(entity), 1);
    }

    addEntityToTile(tile: GridHexagon, entity: BaseEntity): void {
        if (!this.entitiesMap[tile.x + tile.z * 5000]) {
            this.entitiesMap[tile.x + tile.z * 5000] = [];
        }
        this.entitiesMap[tile.x + tile.z * 5000].push(entity);
    }
}

export type EntityUnits = 'Tank' | 'Heli' | 'Infantry' | 'MainBase' | 'Base';

export abstract class BaseEntity {

    animationFrame: number = 0;
    drawTickNumber: number = (Math.random() * 1000) | 0;

    protected missileDirection: Direction = null;
    protected missileAnimationFrame: number = 0;
    protected missileAsset: string;
    protected missileX: number;
    protected missileZ: number;

    abstract realYOffset(): number;

    abstract realXOffset(): number;

    protected _move_animateFromHex: GridHexagon = null;
    protected _move_animateToHex: GridHexagon = null;
    protected _move_durationTicks: number = -1;
    protected _move_currentTick: number = -1;


    protected _attack_animateFromHex: GridHexagon = null;
    protected _attack_animateToHex: GridHexagon = null;
    protected _attack_durationTicks: number = -1;
    protected _attack_currentTick: number = -1;


    public x: number;
    public z: number;
    public entityType: EntityUnits;
    public id: string;
    private health: number;
    private tile: GridHexagon;
    public faction: number;

    public totalVoteCount: number;

    constructor(private entityManager: EntityManager, entity: GameEntity, private  totalFrames: number, private animationSpeed: number) {
        this.faction = entity.factionId;
        this.setHealth(entity.health);

    }

    setId(id: string) {
        this.id = id;
    }


    setHealth(health: number) {
        this.health = health;
    }

    setTile(tile: GridHexagon) {
        if (this.tile) {
            this.entityManager.removeEntityFromTile(this.tile, this);
            this.tile.removeEntity(this);
        }


        this.tile = tile;

        if (tile) {
            this.tile.addEntity(this);
            this.x = this.tile.getRealX();
            this.z = this.tile.getRealZ();
            this.entityManager.addEntityToTile(tile, this);
        }
    }

    getTile(): GridHexagon {
        return this.tile;
    }


    draw(context: CanvasRenderingContext2D) {

        this.drawTickNumber++;

        if (this.drawTickNumber % this.animationSpeed === 0) {
            this.animationFrame = (this.animationFrame + 1) % this.totalFrames;
        }

        if (this._move_currentTick != -1) {

            let percent = this._move_currentTick / this._move_durationTicks;
            if (percent < 1) {
                this.x = Help.lerp(this._move_animateFromHex.getRealX(), this._move_animateToHex.getRealX(), percent);
                this.z = Help.lerp(this._move_animateFromHex.getRealZ(), this._move_animateToHex.getRealZ(), percent);
                this._move_currentTick++;
            }
        }

        if (this._attack_currentTick != -1) {


   /*         if (this.drawTickNumber % this.animationSpeed === 0) {
                this.missileAnimationFrame = (this.missileAnimationFrame + 1) % this.totalFrames;
            }*/

            this.missileAsset = 'Missile';
            let percent = this._attack_currentTick / this._attack_durationTicks;
            if (percent < 1) {
                this.missileX = Help.lerp(this._attack_animateFromHex.getRealX(), this._attack_animateToHex.getRealX(), percent);
                this.missileZ = Help.lerp(this._attack_animateFromHex.getRealZ(), this._attack_animateToHex.getRealZ(), percent);
                this._attack_currentTick++;
            }
        }

    }

    public tick() {
    }

    public onAnimationComplete(frame: AnimationFrame): void {
        switch (frame.type) {
            case AnimationType.Move: {
                if (frame.frameType == AnimationFrameType.Stop) {
                    let tile = this.entityManager.hexBoard.getHexAtSpot(frame.endX || frame.startX, frame.endZ || frame.startZ);
                    tile.clearHighlightColor();
                    this._move_currentTick = -1;
                    this._move_durationTicks = -1;
                    this._move_animateToHex = null;
                    this._move_animateFromHex = null;
                    return;
                }

                let startTile = this.entityManager.hexBoard.getHexAtSpot(frame.startX, frame.startZ);
                startTile.clearHighlightColor();

                let tile = this.entityManager.hexBoard.getHexAtSpot(frame.endX || frame.startX, frame.endZ || frame.startZ);
                let neighbors = tile.getNeighbors();
                tile.setFaction(this.faction);
                for (let j = 0; j < neighbors.length; j++) {
                    let ne = neighbors[j];
                    let tile = this.entityManager.hexBoard.getHexAtSpot(ne.x, ne.z);
                    if (!tile)continue;
                    tile.setFaction(this.faction);
                }
                this.x = tile.getRealX();
                this.z = tile.getRealZ();
                this.setTile(tile);
                break;
            }
            case AnimationType.Attack: {
                if (frame.frameType == AnimationFrameType.Stop) {
                    this._attack_currentTick = -1;
                    this._attack_durationTicks = -1;
                    this._attack_animateToHex = null;
                    this._attack_animateFromHex = null;
                    this.missileAsset = null;
                    return;
                }
                break;
            }

        }
    }

    public onAnimationStart(frame: AnimationFrame): void {

        switch (frame.type) {
            case AnimationType.Move: {
                if (frame.frameType == AnimationFrameType.Start) {
                    this._move_currentTick = -1;
                    this._move_durationTicks = -1;
                    this._move_animateToHex = null;
                    this._move_animateFromHex = null;
                    return;
                }
                let startTile = this.entityManager.hexBoard.getHexAtSpot(frame.startX, frame.startZ);
                let nextTile = this.entityManager.hexBoard.getHexAtSpot(frame.endX || frame.startX, frame.endZ || frame.startZ);
                startTile.setHighlightColor(HexagonColorUtils.highlightColor);
                nextTile.setHighlightColor(HexagonColorUtils.highlightColor);
                break;
            }
            case AnimationType.Attack: {
                if (frame.frameType == AnimationFrameType.Start) {
                    this._attack_currentTick = -1;
                    this._attack_durationTicks = -1;
                    this._attack_animateToHex = null;
                    this._attack_animateFromHex = null;
                    return;
                }
                break;
            }
        }


    }

    abstract getActionFrames(action: GameMetricVoteAction, hexBoard: HexBoard): AnimationFrame[] ;

    abstract executeFrame(hexBoard: HexBoard, frame: AnimationFrame, duration: number): void;

    private currentVotes: GameMetricsVote[] = [];

    resetVotes() {
        this.currentVotes.length = 0;
        this.totalVoteCount = 0;
        this.getTile().clearVoteColor();
        this.getTile().clearSecondaryVoteColor();
    }

    pushVote(vote: GameMetricsVote) {
        this.currentVotes.push(vote);
        let votes = 0;
        for (let i = 0; i < this.currentVotes.length; i++) {
            votes += this.currentVotes[i].votes;
        }
        this.totalVoteCount = votes;
        this.getTile().setVoteColor(HexagonColorUtils.voteColor[Math.min(votes, 10)]);
    }

    setSecondaryVoteColor(spot: GridHexagon) {
        let votes = 0;
        for (let i = 0; i < this.currentVotes.length; i++) {
            let currentVote = this.currentVotes[i];
            switch (currentVote.action.actionType) {
                case "Move":
                    let moveAction = <GameMetricMoveVoteAction> currentVote.action;
                    if (moveAction.x == spot.x && moveAction.z == spot.z) {
                        votes += currentVote.votes;
                    }
                    break;
                case "Attack":
                    let attackAction = <GameMetricAttackVoteAction> currentVote.action;
                    if (attackAction.x == spot.x && attackAction.z == spot.z) {
                        votes += currentVote.votes;
                    }
                    break;
                case "Spawn":
                    let spawnAction = <GameMetricSpawnVoteAction> currentVote.action;
                    if (spawnAction.x == spot.x && spawnAction.z == spot.z) {
                        votes += currentVote.votes;
                    }
                    break;
            }
        }
        if (votes > 0) {
            spot.setSecondaryVoteColor(HexagonColorUtils.voteColor[Math.min(votes, 10)]);
        }
    }

    abstract getYOffset(): number;

    stillAlive: boolean = false;

    markAlive() {
        this.stillAlive = true;
    }
}

export abstract class SixDirectionEntity extends BaseEntity {


    currentDirection: Direction = Direction.Bottom;

    setDirection(direction: "Top" | "Bottom" | "TopLeft" | "BottomLeft" | "TopRight" | "BottomRight") {
        switch (direction) {
            case "Bottom":
                this.currentDirection = Direction.Bottom;
                break;
            case "Top":
                this.currentDirection = Direction.Top;
                break;
            case "BottomLeft":
                this.currentDirection = Direction.BottomLeft;
                break;
            case "BottomRight":
                this.currentDirection = Direction.BottomRight;
                break;
            case "TopLeft":
                this.currentDirection = Direction.TopLeft;
                break;
            case "TopRight":
                this.currentDirection = Direction.TopRight;
                break;
        }
    }

    draw(context: CanvasRenderingContext2D) {
        super.draw(context);

        {
            context.save();
            context.translate(this.x, this.z);

            let asset = AssetManager.assets[this.entityType];
            let image = asset.images[this.animationFrame];


            let ratio = (GridHexagonConstants.width / asset.size.width) / 2;


            let width = GridHexagonConstants.width / 2;
            let height = asset.size.height * ratio;
            context.rotate(this.directionToRadians(this.currentDirection));
            context.drawImage(image, -asset.base.x * ratio - this.realXOffset(), -asset.base.y * ratio - this.realYOffset(), width, height);
            context.restore();
        }


        if(this.missileAsset){
            context.save();
            context.translate(this.missileX, this.missileZ);

            let asset = AssetManager.assets[this.missileAsset];
            let image = asset.images[this.missileAnimationFrame];

            let ratio = (GridHexagonConstants.width / asset.size.width) / 2;

            let width = GridHexagonConstants.width / 2;
            let height = asset.size.height * ratio;
            context.rotate(this.directionToRadians(this.missileDirection));
            context.drawImage(image, -asset.base.x * ratio - this.realXOffset(), -asset.base.y * ratio - this.realYOffset(), width, height);
            context.restore();
        }

    }


    getActionFrames(action: GameMetricVoteAction, hexBoard: HexBoard): AnimationFrame[] {
        let frames: AnimationFrame[] = [];
        switch (action.actionType) {
            case "Move": {
                let moveAction = <GameMetricMoveVoteAction>action;
                let tile = this.getTile();
                let path = hexBoard.pathFind(
                    hexBoard.getHexAtSpot(tile.x, tile.z),
                    hexBoard.getHexAtSpot(moveAction.x, moveAction.z)
                );
                frames.push({
                    type: AnimationType.Move,
                    frameType: AnimationFrameType.Start,
                    startX: path[0].x,
                    startZ: path[0].z,
                    entity: this
                });

                for (let i = 1; i < path.length; i++) {
                    let p = path[i];
                    let oldP = path[i - 1];

                    frames.push({
                        type: AnimationType.Move,
                        frameType: AnimationFrameType.Tick,
                        startX: oldP.x,
                        startZ: oldP.z,
                        endX: p.x,
                        endZ: p.z,
                        entity: this
                    });
                }
                frames.push({
                    type: AnimationType.Move,
                    frameType: AnimationFrameType.Stop,
                    startX: path[path.length - 1].x,
                    startZ: path[path.length - 1].z,
                    entity: this
                });
                break;
            }
            case "Attack": {
                let attackAction = <GameMetricAttackVoteAction>action;
                let tile = this.getTile();
                frames.push({
                    type: AnimationType.Attack,
                    frameType: AnimationFrameType.Start,
                    startX: attackAction.x,
                    startZ: attackAction.z,
                    entity: this
                });
                frames.push({
                    frameType: AnimationFrameType.Tick,
                    type: AnimationType.Attack,
                    startX: tile.x,
                    startZ: tile.z,
                    endX: attackAction.x,
                    endZ: attackAction.z,
                    entity: this
                });
                frames.push({
                    type: AnimationType.Attack,
                    frameType: AnimationFrameType.Stop,
                    startX: attackAction.x,
                    startZ: attackAction.z,
                    entity: this
                });
                break;
            }


        }

        return frames;
    }

    executeFrame(hexBoard: HexBoard, frame: AnimationFrame, duration: number) {
        switch (frame.type) {
            case AnimationType.Move: {
                switch (frame.frameType) {
                    case AnimationFrameType.Tick: {
                        let fromHex = hexBoard.getHexAtSpot(frame.startX, frame.startZ);
                        let toHex = hexBoard.getHexAtSpot(frame.endX, frame.endZ);
                        this.currentDirection = HexUtils.getDirection(fromHex, toHex);
                        this._move_animateFromHex = fromHex;
                        this._move_animateToHex = toHex;
                        this._move_durationTicks = Math.floor(duration / 16);
                        this._move_currentTick = 0;
                        break;
                    }
                }


                break;
            }
            case AnimationType.Attack : {
                switch (frame.frameType) {
                    case AnimationFrameType.Tick: {
                        let fromHex = hexBoard.getHexAtSpot(frame.startX, frame.startZ);
                        let toHex = hexBoard.getHexAtSpot(frame.endX, frame.endZ);
                        this.missileDirection = HexUtils.getDirection(fromHex, toHex);
                        this._attack_animateFromHex = fromHex;
                        this._attack_animateToHex = toHex;
                        this._attack_durationTicks = Math.floor(duration / 16);
                        this._attack_currentTick = 0;
                        break;
                    }
                }
                break;
            }
        }
    }

    private directionToRadians(direction:Direction): number {
        let degrees = 0;
        switch (direction) {
            case Direction.TopLeft:
                degrees = -45;
                break;
            case Direction.Top:
                degrees = 0;
                break;
            case Direction.TopRight:
                degrees = 45;
                break;
            case Direction.BottomRight:
                degrees = 45 + 90;
                break;
            case Direction.Bottom:
                degrees = 180;
                break;
            case Direction.BottomLeft:
                degrees = -45 - 90;
                break;
        }
        return degrees * 0.0174533;
    }
}

export
abstract class StationaryEntity
    extends BaseEntity {
    getActionFrames(action: GameMetricVoteAction, hexBoard: HexBoard): AnimationFrame[] {
        return [];
    }

    draw(context: CanvasRenderingContext2D) {
        super.draw(context);
        context.save();
        context.translate(this.x, this.z);

        let assetName = this.entityType;
        let asset = AssetManager.assets[assetName];
        let image = asset.image || asset.images[this.animationFrame];

        let ratio = (GridHexagonConstants.width / asset.size.width);

        let shrink = .75;
        let width = GridHexagonConstants.width * shrink;
        let height = asset.size.height * ratio * shrink;


        context.drawImage(image, -asset.base.x * ratio * shrink, -asset.base.y * ratio * shrink, width, height);
        context.restore();
    }

    executeFrame(hexBoard: HexBoard, frame: AnimationFrame, duration: number) {
    }
}

export class HeliEntity extends SixDirectionEntity {
    realYOffset(): number {

        let offset = GridHexagonConstants.depthHeight()/3;
        return -(Math.sin(this.drawTickNumber / 10)) * offset + offset * 1;
    }


    realXOffset(): number {
        return 0;
    }

    constructor(entityManager: EntityManager, entity: GameEntity) {
        super(entityManager, entity, 2, 10);
        this.entityType = 'Heli';
    }

    getYOffset(): number {
        return 1;
    }
}
export class TankEntity extends SixDirectionEntity {
    constructor(entityManager: EntityManager, entity: GameEntity) {
        super(entityManager, entity, 2, 10);
        this.entityType = 'Tank';
    }

    realYOffset(): number {
        return 0;
    }

    realXOffset(): number {
        return 0;
    }

    getYOffset(): number {
        return 0;
    }
}
export class InfantryEntity extends SixDirectionEntity {
    constructor(entityManager: EntityManager, entity: GameEntity) {
        super(entityManager, entity, 2, 10);
        this.entityType = 'Infantry';
    }

    realYOffset(): number {
        return 0;
    }

    realXOffset(): number {
        return 0;
    }

    getYOffset(): number {
        return 0;
    }
}
export class MainBaseEntity extends StationaryEntity {
    constructor(entityManager: EntityManager, entity: GameEntity) {
        super(entityManager, entity, 0, 0);
        this.entityType = 'MainBase';
    }

    realYOffset(): number {
        return 0;
    }

    realXOffset(): number {
        return 0;
    }

    getYOffset(): number {
        return 0;
    }

}
export class RegularBaseEntity extends StationaryEntity {
    constructor(entityManager: EntityManager, entity: GameEntity) {
        super(entityManager, entity, 0, 0);
        this.entityType = 'Base';
    }

    realYOffset(): number {
        return 0;
    }

    realXOffset(): number {
        return 0;
    }

    getYOffset(): number {
        return 0;
    }

}

export class EntityDetail {
    public solid: boolean;
    public moveRadius: number;
    public attackRadius: number;
    public spawnRadius: number;
    public attackPower: number;
    public ticksToSpawn: number;
    public health: number;
    public healthRegenRate: number;
    public defaultAction: PossibleActions;
}

export class EntityDetails {

    static instance: EntityDetails = new EntityDetails();
    details: { [entity: string]: EntityDetail } = {};

    constructor() {

        this.details["Base"] = new EntityDetail();
        this.details["Base"].moveRadius = 0;
        this.details["Base"].health = 10;
        this.details["Base"].attackRadius = 0;
        this.details["Base"].attackPower = 0;
        this.details["Base"].ticksToSpawn = 5;
        this.details["Base"].healthRegenRate = 1;
        this.details["Base"].solid = true;
        this.details["Base"].spawnRadius = 3;
        this.details["Base"].defaultAction = 'spawn';


        this.details["MainBase"] = new EntityDetail();
        this.details["MainBase"].moveRadius = 0;
        this.details["MainBase"].health = 30;
        this.details["MainBase"].attackRadius = 0;
        this.details["MainBase"].attackPower = 0;
        this.details["MainBase"].ticksToSpawn = 0;
        this.details["MainBase"].healthRegenRate = 0;
        this.details["MainBase"].solid = true;
        this.details["MainBase"].spawnRadius = 4;
        this.details["MainBase"].defaultAction = 'spawn';


        this.details["Tank"] = new EntityDetail();
        this.details["Tank"].moveRadius = 4;
        this.details["Tank"].health = 8;
        this.details["Tank"].attackRadius = 8;
        this.details["Tank"].attackPower = 3;
        this.details["Tank"].ticksToSpawn = 3;
        this.details["Tank"].healthRegenRate = 1;
        this.details["Tank"].solid = false;
        this.details["Tank"].spawnRadius = 0;
        this.details["Tank"].defaultAction = 'move';


        this.details["Heli"] = new EntityDetail();
        this.details["Heli"].moveRadius = 10;
        this.details["Heli"].health = 2;
        this.details["Heli"].attackRadius = 3;
        this.details["Heli"].attackPower = 3;
        this.details["Heli"].ticksToSpawn = 4;
        this.details["Heli"].healthRegenRate = 1;
        this.details["Heli"].solid = false;
        this.details["Heli"].spawnRadius = 0;
        this.details["Heli"].defaultAction = 'move';


        this.details["Infantry"] = new EntityDetail();
        this.details["Infantry"].moveRadius = 8;
        this.details["Infantry"].health = 4;
        this.details["Infantry"].attackRadius = 3;
        this.details["Infantry"].attackPower = 1;
        this.details["Infantry"].ticksToSpawn = 2;
        this.details["Infantry"].healthRegenRate = 1;
        this.details["Infantry"].solid = false;
        this.details["Infantry"].spawnRadius = 2;
        this.details["Infantry"].defaultAction = 'move';
    }
}