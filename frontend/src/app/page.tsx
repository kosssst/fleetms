'use client';

import Head from 'next/head';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';

const LandingPage = () => {
  return (
    <div className="container">
      <Head>
        <title>Fleet Management System</title>
        <meta name="description" content="Efficiently manage your fleet with our comprehensive solution." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main">
        <Header />

        <section className="hero">
          <div className="heroContent">
            <h2>Streamline Your Fleet Operations</h2>
            <p>Our platform provides the tools you need to manage your vehicles, drivers, and logistics with ease. Boost efficiency and reduce costs with real-time tracking, maintenance scheduling, and detailed reporting.</p>
          </div>
          <div className="heroImage">
            <Image src="fleetmgt_cover.png" alt="Fleet management dashboard illustration" width={600} height={400} unoptimized />
          </div>
        </section>

        <section id="features" className="features">
          <div className="feature">
            <Image src="gps-location-marker-road-map-navigation-svgrepo-com.svg" alt="Real-time tracking icon" width={100} height={100} unoptimized />
            <h3>Real-Time GPS Tracking</h3>
            <p>Monitor your vehicles&apos; location, speed, and status in real-time on an interactive map.</p>
          </div>
          <div className="feature">
            <Image src="calendar-check-svgrepo-com.svg" alt="Maintenance scheduling icon" width={100} height={100} unoptimized />
            <h3>Maintenance Scheduling</h3>
            <p>Automate maintenance reminders and track service history to keep your fleet in top condition.</p>
          </div>
          <div className="feature">
            <Image src="analytics-business-chart-finance-graph-money-svgrepo-com.svg" alt="Analytics and reporting icon" width={100} height={100} unoptimized />
            <h3>Advanced Analytics</h3>
            <p>Gain valuable insights into your fleet&apos;s performance with customizable reports and dashboards.</p>
          </div>
        </section>

        <section id="about" className="about">
          <div className="aboutImage">
            <Image src="47629852-16-9.png" alt="Team working together" width={500} height={350} unoptimized />
          </div>
          <div className="aboutContent">
            <h2>About FleetMS</h2>
            <p>FleetMS was founded by a student of KPI University who wanted to finish his studying for master&apos;s degree. I believe that technology can transform the way businesses handle their vehicle operations.</p>
          </div>
        </section>
      </main>

      <footer id="contact" className="footer">
        <p>&copy; {new Date().getFullYear()} FleetMS. All rights reserved.</p>
        <div className="socialLinks">
          <a href="https://github.com/kosssst">Github</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
