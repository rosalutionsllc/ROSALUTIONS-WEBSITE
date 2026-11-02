import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Images, MoveHorizontal } from "lucide-react";
import type { PublicConfig } from "../../shared/types";

export interface ProjectPhotoPair {
  id: string;
  title: string;
  location: string;
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
}
// Add only real, customer-approved project images, placed in public/projects/.
// Example shape: { id: 'project-1', title: 'Driveway refresh', location: 'Tampa', before: '/projects/1-before.webp', after: '/projects/1-after.webp', beforeAlt: 'Driveway before cleaning', afterAlt: 'The same driveway after cleaning' }
export const PROJECT_PHOTOS: ProjectPhotoPair[] = [];
export function ComparisonSlider({ project }: { project: ProjectPhotoPair }) {
  const [position, setPosition] = useState(50);
  return (
    <article className="comparison-card">
      <div className="comparison-images">
        <img
          src={project.after}
          alt={project.afterAlt}
          loading="lazy"
          width="1000"
          height="750"
        />
        <img
          src={project.before}
          alt={project.beforeAlt}
          loading="lazy"
          width="1000"
          height="750"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <span className="comparison-label before-label">Before</span>
        <span className="comparison-label after-label">After</span>
        <span
          className="comparison-divider"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <MoveHorizontal size={22} />
        </span>
      </div>
      <label className="comparison-control">
        Compare before and after
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={`Before and after comparison for ${project.title}`}
          aria-valuetext={`${position}% before image visible`}
        />
      </label>
      <div className="comparison-caption">
        <h2>{project.title}</h2>
        <p>{project.location}</p>
      </div>
    </article>
  );
}
export default function Gallery({ config }: { config: PublicConfig }) {
  return (
    <>
      <section className="page-heading container">
        <p className="eyebrow">THE ROSALUTIONS DIFFERENCE</p>
        <h1>
          A fresh perspective.
          <br />
          Before & after.
        </h1>
        <p className="page-intro">
          A look at real exterior cleaning projects around{" "}
          {config.business.serviceArea}. Move the slider on each project to see
          the change.
        </p>
      </section>
      <section className="section section-topless">
        <div className="container">
          {PROJECT_PHOTOS.length ? (
            <div className="comparison-grid">
              {PROJECT_PHOTOS.map((project) => (
                <ComparisonSlider key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="gallery-empty">
              <div className="gallery-empty-pattern" aria-hidden="true">
                <Images size={52} strokeWidth={1} />
              </div>
              <div>
                <p className="eyebrow">OUR PROJECT GALLERY IS GROWING</p>
                <h2>
                  Fresh results,
                  <br />
                  coming into focus.
                </h2>
                <p>
                  We’ll share real before-and-after photographs here as they
                  become available. In the meantime, tell us about the space
                  you’d like to refresh.
                </p>
                <Link to="/contact" className="button button-secondary">
                  Let’s talk about your project <ArrowUpRight size={18} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="section soft-section">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">YOUR PROPERTY COULD BE NEXT</p>
            <h2>
              See your estimate.
              <br />
              Picture the possibilities.
            </h2>
            <p>
              Our map tool helps you estimate driveway, sidewalk, and patio
              cleaning in minutes.
            </p>
          </div>
          <Link to="/quote" className="button">
            Get my instant quote <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
