import { DROPINS, MEMBERS, CLUB } from "@/config/club";
import { POINTS } from "@/lib/scoring/rules";

/**
 * "How it works" as a top-down pitch instead of three feature cards.
 * Every line is a path with pathLength=1 so the motion layer can draw it on scroll.
 * Markers carry data-step so they can be revealed in sync with the captions.
 * With no JS or reduced motion, everything is simply visible.
 */
const SEVEN = [
  [118, 120],
  [118, 260],
  [178, 80],
  [178, 190],
  [178, 300],
  [238, 140],
  [238, 240],
] as const;

export function PitchDiagram() {
  const squad = MEMBERS.length + DROPINS.length;
  return (
    <section className="pitch-section" data-pitch aria-labelledby="how-it-works">
      <div className="wrap pitch-grid">
        <div className="pitch-copy">
          <p className="kicker"><b>How it works</b></p>
          <h2 id="how-it-works">
            Three things happen <em>every Thursday.</em>
          </h2>
          <ol className="pitch-steps">
            <li data-caption>
              <span className="step-mark" aria-hidden="true">1</span>
              <div>
                <h3>The draw</h3>
                <p>
                  Nobody picks their mates. A seeded, crypto-random draw splits whoever of the {squad} turns up into White and Red,
                  and anyone can re-run the seed to check it.
                </p>
              </div>
            </li>
            <li data-caption>
              <span className="step-mark" aria-hidden="true">2</span>
              <div>
                <h3>The scoresheet</h3>
                <p>
                  Points come from one place: goal +{POINTS.goal}, assist +{POINTS.assist}, own goal {POINTS.ownGoal}. No ratings, no
                  opinions, fewer arguments.
                </p>
              </div>
            </li>
            <li data-caption>
              <span className="step-mark" aria-hidden="true">3</span>
              <div>
                <h3>Your seven</h3>
                <p>
                  Back {CLUB.picksPerSelector} players before kick-off. Whichever side they land on, their points are yours, and your
                  seven carries over until you change it.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <svg className="pitch-svg" viewBox="0 0 600 380" role="img" aria-label="Pitch diagram: the draw at the centre spot, a goal at the right-hand end, and your seven picks spread across the left half.">
          <g className="pitch-lines" fill="none">
            <path className="pl" pathLength={1} d="M20 20 H580 V360 H20 Z" />
            <path className="pl" pathLength={1} d="M300 20 V360" />
            <path className="pl" pathLength={1} d="M300 140 a50 50 0 1 1 0 100 a50 50 0 1 1 0 -100" />
            <path className="pl" pathLength={1} d="M20 100 H110 V280 H20" />
            <path className="pl" pathLength={1} d="M580 100 H490 V280 H580" />
            <path className="pl" pathLength={1} d="M20 150 H50 V230 H20" />
            <path className="pl" pathLength={1} d="M580 150 H550 V230 H580" />
            <path className="pl" pathLength={1} d="M110 160 a40 40 0 0 1 0 60" />
            <path className="pl" pathLength={1} d="M490 160 a40 40 0 0 0 0 60" />
          </g>

          {/* 1 · the draw: centre spot, split into White and Red */}
          <g className="marker" data-step>
            <circle cx="300" cy="190" r="22" className="mk-ring" />
            <path d="M300 168 a22 22 0 0 0 0 44 Z" className="mk-white" />
            <path d="M300 168 a22 22 0 0 1 0 44 Z" className="mk-red" />
            <text x="300" y="270" className="mk-label">DRAW</text>
          </g>

          {/* 2 · the scoresheet: a goal at the right-hand end */}
          <g className="marker" data-step>
            <circle cx="530" cy="190" r="9" className="mk-ball" />
            <path d="M548 190 h28" className="mk-trail" />
            <text x="530" y="172" className="mk-label mk-plus">+{POINTS.goal}</text>
          </g>

          {/* 3 · your seven */}
          <g className="marker" data-step>
            {SEVEN.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="8" className="mk-pick" />
            ))}
            <text x="178" y="346" className="mk-label">YOUR {CLUB.picksPerSelector}</text>
          </g>
        </svg>
      </div>
    </section>
  );
}
