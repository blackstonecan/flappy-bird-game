import React, { useEffect } from 'react';
import './App.css';

import { NeuralNetwork } from "./neural/nn";

const WIDTH = 800;
const HEIGHT = 500;
const PIPE_WIDTH = 20;
const MIN_PIPE_HEIGHT = 40;
const FPS = 120;
const GRAVITY = 0.1;
const BIRD_RADIUS = 10;
const BIRD_JUMP_VELOCITY = -3;
const PIPE_OPTIMIZATION = 0;
const BIRD_X = 150;
const TOTAL_BIRDS = 1000;
const MAX_VELOCITY = 4;
const BIRD_AGE_THRESHOLD = WIDTH;

const mutateFunction = (x) => {
  if (Math.random() < 0.2) {
    const offset = Math.random();
    return x + offset;
  }
  return x;
};

class Bird {
  constructor(ctx, brain) {
    this.ctx = ctx;
    this.x = BIRD_X;
    this.y = 200;
    this.velocity = 0;
    this.age = 0;
    this.fitness = 0;
    this.brain = brain ? brain.copy() : new NeuralNetwork(3, 2, 1);
  }

  draw() {
    this.ctx.fillStyle = '#F00';
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, BIRD_RADIUS, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  update(data) {
    this.velocity += GRAVITY;
    if (this.velocity > MAX_VELOCITY) this.velocity = MAX_VELOCITY;

    this.y += this.velocity;

    this.age++;

    this.think(data);
  }

  think(data) {

    const y_diff = this.y - data.center;
    const x_diff = data.distance;

    const y_diff_normalized = y_diff / HEIGHT;
    const x_diff_normalized = x_diff / WIDTH;
    const velocity_normalized = this.velocity / MAX_VELOCITY

    const inputs = [
      y_diff_normalized,
      x_diff_normalized,
      velocity_normalized
    ];

    if(y_diff_normalized < -1 || y_diff_normalized > 1 || x_diff_normalized < -1 || x_diff_normalized > 1 || velocity_normalized < -1 || velocity_normalized > 1)
      console.log(inputs);

    const output = this.brain.predict(inputs);

    if (output[0] < 0.5) this.jump();
  }

  mutate() {
    this.brain.mutate(mutateFunction);
  }

  jump() {
    if (this.velocity < 0) return;

    this.velocity = BIRD_JUMP_VELOCITY;
  }
}

class Pipe {
  constructor(ctx, height, space) {
    this.ctx = ctx;
    this.isDead = false;
    this.x = WIDTH;
    this.y = height ? HEIGHT - height : 0;
    this.width = PIPE_WIDTH;
    this.height = height || Math.random() * (HEIGHT - space - MIN_PIPE_HEIGHT * 2) + MIN_PIPE_HEIGHT;
  }

  draw() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  update() {
    this.x -= 1;

    if (this.x + this.width < 0) this.isDead = true;
  }
}

const App = () => {
  const canvasRef = React.createRef();
  var gameSpeed = FPS;
  var pipes = [];
  var birds = [];
  var deadBirds = [];
  var frameCount = 0;
  var space = 150;
  var loop;
  var ctx;

  const generatePipes = () => {
    const firstPipe = new Pipe(ctx, null, space);
    const secondPipeHeight = HEIGHT - firstPipe.height - space;
    const secondPipe = new Pipe(ctx, secondPipeHeight, space);
    return [firstPipe, secondPipe];
  }

  const updateBirdDeadState = () => {
    birds.forEach(bird => {
      let cn = 0;
      if (bird.y > HEIGHT - cn || bird.y < cn) {
        bird.isDead = true;
      }

      pipes.forEach(pipe => {
        const pipeTopLeft = { x: pipe.x - BIRD_RADIUS + PIPE_OPTIMIZATION, y: pipe.y - BIRD_RADIUS + PIPE_OPTIMIZATION };
        const pipeBottomRight = { x: pipe.x + pipe.width + BIRD_RADIUS - PIPE_OPTIMIZATION, y: pipe.y + pipe.height + BIRD_RADIUS - PIPE_OPTIMIZATION };

        if (bird.x > pipeTopLeft.x && bird.x < pipeBottomRight.x && bird.y > pipeTopLeft.y && bird.y < pipeBottomRight.y) {
          bird.isDead = true;
        }
      });
    });
  }

  const update = () => {
    frameCount++;
    if (frameCount % (FPS * 4) === 0) {
      pipes.push(...generatePipes());
    }

    pipes.forEach(pipe => pipe.update());
    birds.forEach(bird => bird.update(getTrainingData()));

    pipes = pipes.filter(pipe => !pipe.isDead);
    updateBirdDeadState();
    deadBirds.push(...birds.filter(bird => bird.isDead));
    birds = birds.filter(bird => !bird.isDead);

    if (birds.length === 0) {
      let totalAge = 0;
      deadBirds.forEach(bird => totalAge += bird.age);

      deadBirds.forEach(bird => bird.fitness = bird.age / totalAge);

      startGame();
    }
  }

  const draw = () => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    pipes.forEach(pipe => pipe.draw());
    birds.forEach(bird => bird.draw());
  }

  const gameLoop = () => {
    console.log(birds.length);
    update();
    draw();
  };

  const getTrainingData = () => {
    let remainingPipes = pipes.filter(pipe => pipe.x > BIRD_X);
    let closestTopPipe = remainingPipes[0];
    let closestBottomPipe = remainingPipes[1];

    let inputs = {
      distance: closestTopPipe.x - BIRD_X,
      center: (closestTopPipe.height + closestBottomPipe.y) / 2
    }

    return inputs;
  }

  const generateBirds = () => {
    const birds = [];
    for (let i = 0; i < TOTAL_BIRDS; i += 1) {
      let brain;
      if (deadBirds.length) brain = pickOne();
      const newBird = new Bird(ctx, Math.random() < 0.9 ? brain : null);
      birds.push(newBird);
    }
    return birds;
  }

  const startGame = () => {
    clearInterval(loop);
    frameCount = 0;
    ctx = ctx || canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    pipes = generatePipes();
    birds = generateBirds();
    loop = setInterval(gameLoop, 1000 / gameSpeed);
  }

  const pickOne = () => {
    let bird = deadBirds.sort((a, b) => a.age - b.age)[deadBirds.length - 1];
    if (bird.age < BIRD_AGE_THRESHOLD) return null;
    else {
      if(Math.random() < 0.7) return bird.brain;
      else {
        let newBrain = bird.brain.copy();
        newBrain.mutate(mutateFunction);
        return newBrain;
      }
    }
  }

  useEffect(() => {
    if (ctx) return;
  
    startGame();
  }, [ctx, startGame]);

  const handleGameSpeed = (e) => {
    gameSpeed = e.target.value;
    startGame();
  }

  return (
    <div className="App">
      {canvasRef &&
        <>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            style={{ border: "1px solid #c3c3c3", marginTop: "24px" }}>
            Your browser does not support the HTML5 canvas tag.
          </canvas>
        </>
      }
      <div>
        <input type="range" min="120" max="1000" defaultValue="120" onChange={handleGameSpeed} />
      </div>
    </div>
  );
}

export default App;
